begin;
create extension if not exists pgtap;
select plan(46);

insert into identity.user_account (
  user_account_id,
  display_name,
  account_status
) values (
  '280c0000-0000-4000-8000-000000000001',
  'Shared Helper Invitation Owner',
  'active'
);

insert into core.organization (
  organization_id,
  organization_name,
  approval_status,
  status
) values (
  '280c0100-0000-4000-8000-000000000001',
  'Shared Helper Organization',
  'draft',
  'active'
);
insert into core.practice (
  practice_id,
  organization_id,
  practice_name,
  approval_status,
  status
) values (
  '280c0200-0000-4000-8000-000000000001',
  '280c0100-0000-4000-8000-000000000001',
  'Shared Helper Practice',
  'draft',
  'active'
);
insert into core.guide_profile (
  guide_profile_id,
  user_account_id,
  guide_display_name,
  setup_status,
  status
) values (
  '280c0300-0000-4000-8000-000000000001',
  '280c0000-0000-4000-8000-000000000001',
  'Shared Helper Guide',
  'profile_pending',
  'active'
);

insert into core.explorer_invite (
  explorer_invite_id,
  guide_profile_id,
  practice_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_name,
  invite_status,
  expires_at
) values
(
  '280c1000-0000-4000-8000-000000000001',
  '280c0300-0000-4000-8000-000000000001',
  '280c0200-0000-4000-8000-000000000001',
  'new.explorer@example.test',
  'new.explorer@example.test',
  'email',
  'New Explorer',
  'created',
  now() + interval '24 hours'
),
(
  '280c1000-0000-4000-8000-000000000002',
  '280c0300-0000-4000-8000-000000000001',
  '280c0200-0000-4000-8000-000000000001',
  'existing.explorer@example.test',
  'existing.explorer@example.test',
  'email',
  'Existing Explorer',
  'created',
  now() + interval '24 hours'
);

insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  explorer_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values
(
  '280c3000-0000-4000-8000-000000000001',
  '280c1000-0000-4000-8000-000000000001',
  'supabase',
  now(),
  now() + interval '24 hours',
  'security_log'
),
(
  '280c3000-0000-4000-8000-000000000002',
  '280c1000-0000-4000-8000-000000000002',
  'supabase',
  now(),
  now() + interval '24 hours',
  'security_log'
);

create temporary table s02c_before_new as
select
  (select pg_catalog.count(*) from audit.audit_event) as audit_count,
  (select pg_catalog.count(*) from identity.authorizing_evidence_consumption)
    as evidence_count,
  (
    select pg_catalog.jsonb_agg(
             pg_catalog.to_jsonb(invite)
             order by invite.explorer_invite_id
           )
      from core.explorer_invite invite
     where invite.explorer_invite_id in (
       '280c1000-0000-4000-8000-000000000001',
       '280c1000-0000-4000-8000-000000000002'
     )
  ) as explorer_invite_rows,
  (
    select pg_catalog.jsonb_agg(
             pg_catalog.to_jsonb(reservation)
             order by reservation.provisioning_reservation_id
           )
      from identity.auth_provider_provisioning_reservation reservation
     where reservation.provisioning_reservation_id in (
       '280c3000-0000-4000-8000-000000000001',
       '280c3000-0000-4000-8000-000000000002'
     )
  ) as provisioning_reservation_rows,
  (select pg_catalog.count(*) from core.guide_explorer_relationship)
    as relationship_count,
  (select pg_catalog.count(*) from identity.user_session) as session_count,
  (select pg_catalog.count(*) from core.consent_record) as consent_count;

create temporary table s02c_new_result as
select *
  from private.solmind_provision_invited_identity(
    null,
    null,
    'explorer',
    'email',
    'new.explorer@example.test',
    'new.explorer@example.test',
    's02c-provider-new',
    'new.explorer@example.test',
    '280c3000-0000-4000-8000-000000000001',
    'New Explorer'
  );

select ok(
  (
    select account_created
       and contact_created
       and provider_identity_created
       and role_created
       and profile_created
      from s02c_new_result
  ),
  'new Explorer branch reports all five inserted entities'
);
select ok(
  (select not profile_onboarding_changed from s02c_new_result),
  'new Explorer profile creation is not reported as an onboarding transition'
);
select is(
  (
    select assignment.role_code
      from identity.user_role_assignment assignment
     where assignment.user_role_assignment_id =
       (select user_role_assignment_id from s02c_new_result)
  ),
  'explorer',
  'new Explorer branch creates only the Explorer role'
);
select is(
  (
    select profile.onboarding_status
      from core.explorer_profile profile
     where profile.explorer_profile_id = (select profile_id from s02c_new_result)
  ),
  'consent_pending',
  'new Explorer profile starts at consent_pending'
);
select is(
  (
    select profile.explorer_display_name
      from core.explorer_profile profile
     where profile.explorer_profile_id = (select profile_id from s02c_new_result)
  ),
  'New Explorer',
  'new Explorer profile uses the supplied sanitized display name'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_profile profile
     where profile.user_account_id = (select user_account_id from s02c_new_result)
  ),
  0,
  'new Explorer branch creates no Guide profile'
);
select is(
  (select invite_status from core.explorer_invite
    where explorer_invite_id = '280c1000-0000-4000-8000-000000000001'),
  'created',
  'protected helper does not mutate its reservation invitation'
);
select is(
  (select pg_catalog.count(*) from audit.audit_event),
  (select audit_count from s02c_before_new),
  'protected helper writes no audit row'
);
select is(
  (select pg_catalog.count(*) from identity.authorizing_evidence_consumption),
  (select evidence_count from s02c_before_new),
  'protected helper consumes no authorizing evidence'
);
select is(
  (select pg_catalog.count(*) from core.guide_explorer_relationship),
  (select relationship_count from s02c_before_new),
  'protected helper creates no Guide-Explorer relationship'
);
select is(
  (select pg_catalog.count(*) from identity.user_session),
  (select session_count from s02c_before_new),
  'protected helper creates no session'
);
select is(
  (select pg_catalog.count(*) from core.consent_record),
  (select consent_count from s02c_before_new),
  'protected helper creates no consent record'
);

insert into identity.user_account (
  user_account_id,
  display_name,
  account_status
) values (
  '280c4000-0000-4000-8000-000000000001',
  'Existing Explorer Account',
  'active'
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
  verified_at,
  verification_method,
  status
) values (
  '280c4100-0000-4000-8000-000000000001',
  '280c4000-0000-4000-8000-000000000001',
  'email',
  'primary',
  'existing.explorer@example.test',
  'existing.explorer@example.test',
  true,
  true,
  now(),
  'existing_fixture',
  'active'
);
insert into identity.auth_provider_identity (
  auth_provider_identity_id,
  user_account_id,
  provider_name,
  provider_user_id,
  provider_email,
  status
) values (
  '280c4200-0000-4000-8000-000000000001',
  '280c4000-0000-4000-8000-000000000001',
  'supabase',
  's02c-provider-existing',
  'existing.explorer@example.test',
  'active'
);

create temporary table s02c_existing_result as
select *
  from private.solmind_provision_invited_identity(
    '280c4000-0000-4000-8000-000000000001',
    '280c4100-0000-4000-8000-000000000001',
    'explorer',
    'email',
    'existing.explorer@example.test',
    'existing.explorer@example.test',
    's02c-provider-existing',
    'existing.explorer@example.test',
    '280c3000-0000-4000-8000-000000000002',
    'Existing Explorer'
  );

select ok(
  (
    select not account_created
       and not contact_created
       and not provider_identity_created
       and role_created
       and profile_created
      from s02c_existing_result
  ),
  'existing eligible account receives only the missing Explorer role and profile'
);
select ok(
  (select not profile_onboarding_changed from s02c_existing_result),
  'missing-profile creation is not reported as an onboarding transition'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_role_assignment assignment
     where assignment.user_account_id = '280c4000-0000-4000-8000-000000000001'
       and assignment.role_code = 'explorer'
  ),
  1,
  'existing account has exactly one Explorer role'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_profile profile
     where profile.user_account_id = '280c4000-0000-4000-8000-000000000001'
  ),
  1,
  'existing account has exactly one Explorer profile'
);

update core.explorer_profile
   set onboarding_status = 'paused',
       preferred_contact_channel = 'sms',
       profile_notes = 'Preserve prior notes',
       metadata = '{"prior":"preserved"}'::jsonb,
       updated_at = null
 where user_account_id = '280c4000-0000-4000-8000-000000000001';

create temporary table s02c_reentry_result as
select *
  from private.solmind_provision_invited_identity(
    '280c4000-0000-4000-8000-000000000001',
    '280c4100-0000-4000-8000-000000000001',
    'explorer',
    'email',
    'existing.explorer@example.test',
    'existing.explorer@example.test',
    's02c-provider-existing',
    'existing.explorer@example.test',
    '280c3000-0000-4000-8000-000000000002',
    'Replacement Name Must Not Apply'
  );

select ok(
  (
    select not account_created
       and not contact_created
       and not provider_identity_created
       and not role_created
       and not profile_created
      from s02c_reentry_result
  ),
  'Explorer re-entry reuses every existing identity entity'
);
select ok(
  (select profile_onboarding_changed from s02c_reentry_result),
  'paused Explorer re-entry returns the exact transition signal'
);
select is(
  (
    select onboarding_status
      from core.explorer_profile
     where user_account_id = '280c4000-0000-4000-8000-000000000001'
  ),
  'consent_pending',
  'paused Explorer re-entry advances only onboarding status'
);
select is(
  (
    select explorer_display_name
      from core.explorer_profile
     where user_account_id = '280c4000-0000-4000-8000-000000000001'
  ),
  'Existing Explorer',
  'Explorer re-entry preserves the existing display name'
);
select is(
  (
    select preferred_contact_channel
      from core.explorer_profile
     where user_account_id = '280c4000-0000-4000-8000-000000000001'
  ),
  'sms',
  'Explorer re-entry preserves preferred contact channel'
);
select is(
  (
    select profile_notes
      from core.explorer_profile
     where user_account_id = '280c4000-0000-4000-8000-000000000001'
  ),
  'Preserve prior notes',
  'Explorer re-entry preserves prior profile notes'
);
select is(
  (
    select metadata
      from core.explorer_profile
     where user_account_id = '280c4000-0000-4000-8000-000000000001'
  ),
  '{"prior":"preserved"}'::jsonb,
  'Explorer re-entry preserves prior metadata'
);
select ok(
  (
    select updated_at is not null
      from core.explorer_profile
     where user_account_id = '280c4000-0000-4000-8000-000000000001'
  ),
  'Explorer re-entry timestamps the approved state transition'
);

update core.explorer_profile
   set onboarding_status = 'active',
       updated_at = null
 where user_account_id = '280c4000-0000-4000-8000-000000000001';
select lives_ok(
  $$select * from private.solmind_provision_invited_identity(
      '280c4000-0000-4000-8000-000000000001',
      '280c4100-0000-4000-8000-000000000001',
      'explorer',
      'email',
      'existing.explorer@example.test',
      'existing.explorer@example.test',
      's02c-provider-existing',
      'existing.explorer@example.test',
      '280c3000-0000-4000-8000-000000000002',
      'Existing Explorer'
    )$$,
  'active Explorer onboarding state remains eligible'
);
select ok(
  (
    select not result.profile_onboarding_changed
      from private.solmind_provision_invited_identity(
        '280c4000-0000-4000-8000-000000000001',
        '280c4100-0000-4000-8000-000000000001',
        'explorer',
        'email',
        'existing.explorer@example.test',
        'existing.explorer@example.test',
        's02c-provider-existing',
        'existing.explorer@example.test',
        '280c3000-0000-4000-8000-000000000002',
        'Existing Explorer'
      ) result
  ),
  'unchanged active Explorer state returns no transition signal'
);
select is(
  (
    select onboarding_status
      from core.explorer_profile
     where user_account_id = '280c4000-0000-4000-8000-000000000001'
  ),
  'active',
  'active Explorer onboarding state remains unchanged'
);

update core.explorer_profile
   set onboarding_status = 'invited',
       updated_at = null
 where user_account_id = '280c4000-0000-4000-8000-000000000001';
select ok(
  (
    select not result.profile_onboarding_changed
       and profile.onboarding_status = 'invited'
       and profile.updated_at is null
      from private.solmind_provision_invited_identity(
        '280c4000-0000-4000-8000-000000000001',
        '280c4100-0000-4000-8000-000000000001',
        'explorer',
        'email',
        'existing.explorer@example.test',
        'existing.explorer@example.test',
        's02c-provider-existing',
        'existing.explorer@example.test',
        '280c3000-0000-4000-8000-000000000002',
        'Existing Explorer'
      ) result
      cross join core.explorer_profile profile
     where profile.user_account_id = '280c4000-0000-4000-8000-000000000001'
  ),
  'invited Explorer state and timestamp remain unchanged'
);

update core.explorer_profile
   set onboarding_status = 'contact_verified',
       updated_at = null
 where user_account_id = '280c4000-0000-4000-8000-000000000001';
select ok(
  (
    select not result.profile_onboarding_changed
       and profile.onboarding_status = 'contact_verified'
       and profile.updated_at is null
      from private.solmind_provision_invited_identity(
        '280c4000-0000-4000-8000-000000000001',
        '280c4100-0000-4000-8000-000000000001',
        'explorer',
        'email',
        'existing.explorer@example.test',
        'existing.explorer@example.test',
        's02c-provider-existing',
        'existing.explorer@example.test',
        '280c3000-0000-4000-8000-000000000002',
        'Existing Explorer'
      ) result
      cross join core.explorer_profile profile
     where profile.user_account_id = '280c4000-0000-4000-8000-000000000001'
  ),
  'contact-verified Explorer state and timestamp remain unchanged'
);

update core.explorer_profile
   set onboarding_status = 'intake_pending',
       updated_at = null
 where user_account_id = '280c4000-0000-4000-8000-000000000001';
select ok(
  (
    select not result.profile_onboarding_changed
       and profile.onboarding_status = 'intake_pending'
       and profile.updated_at is null
      from private.solmind_provision_invited_identity(
        '280c4000-0000-4000-8000-000000000001',
        '280c4100-0000-4000-8000-000000000001',
        'explorer',
        'email',
        'existing.explorer@example.test',
        'existing.explorer@example.test',
        's02c-provider-existing',
        'existing.explorer@example.test',
        '280c3000-0000-4000-8000-000000000002',
        'Existing Explorer'
      ) result
      cross join core.explorer_profile profile
     where profile.user_account_id = '280c4000-0000-4000-8000-000000000001'
  ),
  'intake-pending Explorer state and timestamp remain unchanged'
);

update identity.user_role_assignment
   set role_status = 'suspended'
 where user_account_id = '280c4000-0000-4000-8000-000000000001'
   and role_code = 'explorer';
select throws_ok(
  $$select * from private.solmind_provision_invited_identity(
      '280c4000-0000-4000-8000-000000000001',
      '280c4100-0000-4000-8000-000000000001',
      'explorer',
      'email',
      'existing.explorer@example.test',
      'existing.explorer@example.test',
      's02c-provider-existing',
      'existing.explorer@example.test',
      '280c3000-0000-4000-8000-000000000002',
      'Existing Explorer'
    )$$,
  'P0001',
  'solmind_invited_identity_ineligible',
  'suspended Explorer role fails closed'
);
update identity.user_role_assignment
   set role_status = 'active'
 where user_account_id = '280c4000-0000-4000-8000-000000000001'
   and role_code = 'explorer';

update core.explorer_profile
   set onboarding_status = 'ended',
       updated_at = null
 where user_account_id = '280c4000-0000-4000-8000-000000000001';
select lives_ok(
  $$select * from private.solmind_provision_invited_identity(
      '280c4000-0000-4000-8000-000000000001',
      '280c4100-0000-4000-8000-000000000001',
      'explorer',
      'email',
      'existing.explorer@example.test',
      'existing.explorer@example.test',
      's02c-provider-existing',
      'existing.explorer@example.test',
      '280c3000-0000-4000-8000-000000000002',
      'Existing Explorer'
    )$$,
  'ended Explorer profile may re-enter through the approved transition'
);
select is(
  (
    select onboarding_status
      from core.explorer_profile
     where user_account_id = '280c4000-0000-4000-8000-000000000001'
  ),
  'consent_pending',
  'ended Explorer re-entry advances to consent_pending'
);

update core.explorer_profile
   set status = 'inactive'
 where user_account_id = '280c4000-0000-4000-8000-000000000001';
select throws_ok(
  $$select * from private.solmind_provision_invited_identity(
      '280c4000-0000-4000-8000-000000000001',
      '280c4100-0000-4000-8000-000000000001',
      'explorer',
      'email',
      'existing.explorer@example.test',
      'existing.explorer@example.test',
      's02c-provider-existing',
      'existing.explorer@example.test',
      '280c3000-0000-4000-8000-000000000002',
      'Existing Explorer'
    )$$,
  'P0001',
  'solmind_invited_identity_ineligible',
  'inactive Explorer profile fails closed'
);

update core.explorer_profile
   set status = 'deleted'
 where user_account_id = '280c4000-0000-4000-8000-000000000001';
select throws_ok(
  $$select * from private.solmind_provision_invited_identity(
      '280c4000-0000-4000-8000-000000000001',
      '280c4100-0000-4000-8000-000000000001',
      'explorer',
      'email',
      'existing.explorer@example.test',
      'existing.explorer@example.test',
      's02c-provider-existing',
      'existing.explorer@example.test',
      '280c3000-0000-4000-8000-000000000002',
      'Existing Explorer'
    )$$,
  'P0001',
  'solmind_invited_identity_ineligible',
  'deleted Explorer profile fails closed'
);

update core.explorer_profile
   set status = 'active',
       onboarding_status = 'active'
 where user_account_id = '280c4000-0000-4000-8000-000000000001';
insert into identity.user_contact_method (
  user_contact_method_id,
  user_account_id,
  contact_method_type,
  contact_label,
  contact_value,
  normalized_contact_value,
  phone_type,
  sms_capable,
  login_enabled,
  is_verified,
  verified_at,
  verification_method,
  status
) values (
  '280c4100-0000-4000-8000-000000000002',
  '280c4000-0000-4000-8000-000000000001',
  'phone',
  'alternate',
  '+15550002800',
  '+15550002800',
  'wireless',
  true,
  true,
  true,
  now(),
  'existing_fixture',
  'active'
);
select lives_ok(
  $$select * from private.solmind_provision_invited_identity(
      '280c4000-0000-4000-8000-000000000001',
      '280c4100-0000-4000-8000-000000000002',
      'explorer',
      'phone',
      '+15550002800',
      '+15550002800',
      's02c-provider-existing',
      'existing.explorer@example.test',
      '280c3000-0000-4000-8000-000000000002',
      'Existing Explorer'
    )$$,
  'phone invitation is eligible when the provider email has one matching verified login contact'
);
update identity.user_contact_method
   set login_enabled = false
 where user_contact_method_id = '280c4100-0000-4000-8000-000000000001';
select throws_ok(
  $$select * from private.solmind_provision_invited_identity(
      '280c4000-0000-4000-8000-000000000001',
      '280c4100-0000-4000-8000-000000000002',
      'explorer',
      'phone',
      '+15550002800',
      '+15550002800',
      's02c-provider-existing',
      'existing.explorer@example.test',
      '280c3000-0000-4000-8000-000000000002',
      'Existing Explorer'
    )$$,
  'P0001',
  'solmind_invited_identity_ineligible',
  'phone invitation fails closed without a matching login-enabled provider email contact'
);

select throws_ok(
  $$select * from private.solmind_provision_invited_identity(
      null,
      null,
      'admin',
      'email',
      'invalid@example.test',
      'invalid@example.test',
      's02c-provider-invalid',
      'invalid@example.test',
      '280c3000-0000-4000-8000-000000000001',
      'Invalid Role'
    )$$,
  'P0001',
  'solmind_invited_identity_invalid_role',
  'unsupported role fails with the fixed role error'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_account
     where display_name = 'Invalid Role'
  ),
  0,
  'unsupported-role denial leaves no account residue'
);
select is(
  (select pg_catalog.count(*) from audit.audit_event),
  (select audit_count from s02c_before_new),
  'Explorer create, reuse, transition, and denial remain audit-neutral'
);
select is(
  (select pg_catalog.count(*) from identity.authorizing_evidence_consumption),
  (select evidence_count from s02c_before_new),
  'Explorer create, reuse, transition, and denial remain evidence-neutral'
);
select is(
  (
    select pg_catalog.jsonb_agg(
             pg_catalog.to_jsonb(invite)
             order by invite.explorer_invite_id
           )
      from core.explorer_invite invite
     where invite.explorer_invite_id in (
       '280c1000-0000-4000-8000-000000000001',
       '280c1000-0000-4000-8000-000000000002'
     )
  ),
  (select explorer_invite_rows from s02c_before_new),
  'Explorer create, reuse, transition, and denial remain invitation-neutral'
);
select is(
  (
    select pg_catalog.jsonb_agg(
             pg_catalog.to_jsonb(reservation)
             order by reservation.provisioning_reservation_id
           )
      from identity.auth_provider_provisioning_reservation reservation
     where reservation.provisioning_reservation_id in (
       '280c3000-0000-4000-8000-000000000001',
       '280c3000-0000-4000-8000-000000000002'
     )
  ),
  (select provisioning_reservation_rows from s02c_before_new),
  'Explorer create, reuse, transition, and denial remain reservation-neutral'
);
select is(
  (select pg_catalog.count(*) from core.guide_explorer_relationship),
  (select relationship_count from s02c_before_new),
  'Explorer create, reuse, transition, and denial remain relationship-neutral'
);
select is(
  (select pg_catalog.count(*) from identity.user_session),
  (select session_count from s02c_before_new),
  'Explorer create, reuse, transition, and denial remain session-neutral'
);
select is(
  (select pg_catalog.count(*) from core.consent_record),
  (select consent_count from s02c_before_new),
  'Explorer create, reuse, transition, and denial remain consent-neutral'
);

select * from finish();
rollback;
