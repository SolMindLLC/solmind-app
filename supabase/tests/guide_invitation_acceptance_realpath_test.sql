begin;
create extension if not exists pgtap;
select plan(93);

insert into identity.user_account (
  user_account_id,
  display_name,
  account_status
) values (
  '270c0000-0000-4000-8000-000000000001',
  'P27-C Admin Fixture',
  'active'
);

create temporary table p27c_invalid_before as
select pg_catalog.count(*)::integer as audit_count
  from audit.audit_event;

select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      null,
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      'p27c-provider-invalid',
      'invalid.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_invalid_request',
  'null invitation id receives the fixed invalid-request error'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      null,
      '270c3000-0000-4000-8000-000000000099',
      'p27c-provider-invalid',
      'invalid.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_invalid_request',
  'null challenge id receives the fixed invalid-request error'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      null,
      'p27c-provider-invalid',
      'invalid.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_invalid_request',
  'null reservation id receives the fixed invalid-request error'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      null,
      'invalid.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_invalid_request',
  'null provider-user id receives the fixed invalid-request error'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      'p27c-provider-invalid',
      null
    )$$,
  'P0001',
  'solmind_guide_accept_invalid_request',
  'null provider email receives the fixed invalid-request error'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      '',
      'invalid.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_invalid_request',
  'empty provider-user id receives the fixed invalid-request error'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      'p27c-provider-invalid',
      'Invalid.Guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_invalid_request',
  'non-normalized provider email receives the fixed invalid-request error'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      ' p27c-provider-invalid',
      'invalid.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_invalid_request',
  'provider-user id with surrounding whitespace receives invalid-request'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      repeat('p', 257),
      'invalid.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_invalid_request',
  'overlong provider-user id receives the fixed invalid-request error'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      'p27c-provider-invalid',
      'ab'
    )$$,
  'P0001',
  'solmind_guide_accept_invalid_request',
  'undersized provider email receives the fixed invalid-request error'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      'p27c-provider-invalid',
      repeat('a', 321)
    )$$,
  'P0001',
  'solmind_guide_accept_invalid_request',
  'overlong provider email receives the fixed invalid-request error'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      'p27c-provider-invalid',
      ' invalid.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_invalid_request',
  'provider email with surrounding whitespace receives invalid-request'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      'p',
      'invalid.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'one-byte provider-user id passes input validation'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      repeat('p', 256),
      'invalid.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  '256-byte provider-user id passes input validation'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      'p27c-provider-invalid',
      'a@b'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'three-byte normalized provider email passes input validation'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000099',
      '270c2000-0000-4000-8000-000000000099',
      '270c3000-0000-4000-8000-000000000099',
      'p27c-provider-invalid',
      repeat('a', 64)
        || '@'
        || repeat('b', 63)
        || '.'
        || repeat('c', 63)
        || '.'
        || repeat('d', 63)
        || '.'
        || repeat('e', 63)
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  '320-byte normalized provider email passes input validation'
);
select is(
  (select pg_catalog.count(*)::integer from audit.audit_event),
  (select audit_count from p27c_invalid_before),
  'invalid-input denials write no audit row'
);

-- The structural index normally prevents this historical duplicate. Dropping
-- it inside the rolled-back test transaction permits direct proof that the
-- acceptance transaction still defensively revokes surviving siblings.
drop index core.guide_invite_one_open_contact_idx;

insert into core.guide_invite (
  guide_invite_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_name,
  invited_by_user_account_id,
  invite_status,
  expires_at,
  sent_at
) values
(
  '270c1000-0000-4000-8000-000000000001',
  'new.guide@example.test',
  'new.guide@example.test',
  'email',
  E'  Ada\tLovelace  ',
  '270c0000-0000-4000-8000-000000000001',
  'sent',
  clock_timestamp() + interval '24 hours',
  clock_timestamp()
),
(
  '270c1000-0000-4000-8000-000000000002',
  'new.guide@example.test',
  'new.guide@example.test',
  'email',
  'Older Invite',
  '270c0000-0000-4000-8000-000000000001',
  'created',
  clock_timestamp() + interval '24 hours',
  null
);

insert into identity.verification_challenge (
  verification_challenge_id,
  normalized_contact_value,
  contact_method_type,
  purpose,
  delivery_channel,
  expires_at,
  used_at
) values (
  '270c2000-0000-4000-8000-000000000001',
  'new.guide@example.test',
  'email',
  'contact_verify',
  'email',
  clock_timestamp() + interval '10 minutes',
  clock_timestamp()
);

insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  guide_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  '270c3000-0000-4000-8000-000000000001',
  '270c1000-0000-4000-8000-000000000001',
  'supabase',
  now(),
  now() + interval '24 hours',
  'security_log'
);

create temporary table p27c_accept_result as
select *
  from public.solmind_accept_guide_invitation(
    '270c1000-0000-4000-8000-000000000001',
    '270c2000-0000-4000-8000-000000000001',
    '270c3000-0000-4000-8000-000000000001',
    '270c-provider-user-new',
    'new.guide@example.test'
  );

select is(
  (select outcome from p27c_accept_result),
  'accepted',
  'new Guide acceptance returns accepted'
);
select ok(
  (select user_account_id is not null from p27c_accept_result),
  'new Guide acceptance returns the account id'
);
select ok(
  (select guide_profile_id is not null from p27c_accept_result),
  'new Guide acceptance returns the Guide profile id'
);
select is(
  (
    select account.display_name
      from identity.user_account account
     where account.user_account_id =
       (select user_account_id from p27c_accept_result)
  ),
  'Ada Lovelace',
  'new account uses the invitation-derived sanitized display name'
);
select is(
  (
    select account.account_status
      from identity.user_account account
     where account.user_account_id =
       (select user_account_id from p27c_accept_result)
  ),
  'active',
  'new Guide account starts active'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_contact_method contact
     where contact.user_account_id =
       (select user_account_id from p27c_accept_result)
       and contact.contact_method_type = 'email'
       and contact.normalized_contact_value = 'new.guide@example.test'
       and contact.status = 'active'
       and contact.is_verified
       and contact.login_enabled
  ),
  1,
  'new Guide receives exactly one verified active login contact'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_identity provider_identity
     where provider_identity.user_account_id =
       (select user_account_id from p27c_accept_result)
       and provider_identity.provider_name = 'supabase'
       and provider_identity.provider_user_id = '270c-provider-user-new'
       and provider_identity.provider_email = 'new.guide@example.test'
       and provider_identity.provisioning_reservation_id =
         '270c3000-0000-4000-8000-000000000001'
       and provider_identity.status = 'active'
  ),
  1,
  'new Guide receives one reservation-correlated provider binding'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_role_assignment assignment
     where assignment.user_account_id =
       (select user_account_id from p27c_accept_result)
       and assignment.role_code = 'guide'
       and assignment.role_status = 'active'
  ),
  1,
  'new Guide receives one active Guide role'
);
select is(
  (
    select profile.setup_status
      from core.guide_profile profile
     where profile.guide_profile_id =
       (select guide_profile_id from p27c_accept_result)
  ),
  'profile_pending',
  'new Guide profile starts profile_pending'
);
select is(
  (
    select profile.guide_display_name
      from core.guide_profile profile
     where profile.guide_profile_id =
       (select guide_profile_id from p27c_accept_result)
  ),
  'Ada Lovelace',
  'new Guide profile uses the same sanitized initial name'
);
select is(
  (
    select consumption.consumer_type
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       '270c2000-0000-4000-8000-000000000001'
  ),
  'guide_invitation_acceptance',
  'acceptance consumes evidence under the Guide consumer'
);
select is(
  (
    select consumption.consumer_record_id
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       '270c2000-0000-4000-8000-000000000001'
  ),
  '270c1000-0000-4000-8000-000000000001'::uuid,
  'accepted Guide invitation owns the evidence consumption'
);
select is(
  (
    select invitation.invite_status
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       '270c1000-0000-4000-8000-000000000001'
  ),
  'accepted',
  'target invitation becomes accepted'
);
select is(
  (
    select invitation.accepted_by_user_account_id
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       '270c1000-0000-4000-8000-000000000001'
  ),
  (select user_account_id from p27c_accept_result),
  'accepted invitation records the exact account'
);
select is(
  (
    select invitation.invite_status
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       '270c1000-0000-4000-8000-000000000002'
  ),
  'revoked',
  'open sibling becomes revoked'
);
select ok(
  (
    select invitation.revoked_at is not null
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       '270c1000-0000-4000-8000-000000000002'
  ),
  'revoked sibling receives the database timestamp'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.reason_code = 'invitation_accepted'
       and event.actor_user_account_id =
         (select user_account_id from p27c_accept_result)
  ),
  6,
  'new-account acceptance writes six human-attributed state-change rows'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.event_type = 'invite_revoked'
       and event.target_entity_id =
         '270c1000-0000-4000-8000-000000000002'
       and event.actor_user_account_id is null
       and event.actor_role_context = 'system'
       and event.action = 'revoke'
       and event.reason_code = 'superseded_by_acceptance'
       and event.event_summary =
         'Sibling invitation revoked after acceptance.'
       and event.metadata = '{}'::jsonb
  ),
  1,
  'sibling revocation has the exact system-attributed audit row'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.event_type = 'invite_accepted'
       and event.target_entity_type = 'guide_invite'
       and event.target_entity_id =
         '270c1000-0000-4000-8000-000000000001'
       and event.action = 'accept'
       and event.reason_code = 'invitation_accepted'
       and event.event_summary = 'Invitation accepted.'
       and event.metadata = '{}'::jsonb
  ),
  1,
  'target acceptance has the exact human-attributed audit row'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.event_type = 'auth_provider_identity_bound'
       and event.metadata =
         pg_catalog.jsonb_build_object('provider_name', 'supabase')
  ),
  1,
  'provider-binding audit metadata contains only the closed provider token'
);
select ok(
  not exists (
    select 1
      from audit.audit_event event
     where pg_catalog.to_jsonb(event)::text like '%270c-provider-user-new%'
        or pg_catalog.to_jsonb(event)::text like '%new.guide@example.test%'
  ),
  'audit rows do not persist provider-user id or normalized contact'
);

select pg_catalog.count(*)::integer as audit_count
  into temporary table p27c_before_recovery
  from audit.audit_event;

create temporary table p27c_recovery_result as
select *
  from public.solmind_accept_guide_invitation(
    '270c1000-0000-4000-8000-000000000001',
    '270c2000-0000-4000-8000-000000000001',
    '270c3000-0000-4000-8000-000000000001',
    '270c-provider-user-new',
    'new.guide@example.test'
  );

select is(
  (select outcome from p27c_recovery_result),
  'existing',
  'exact committed-response retry returns existing'
);
select is(
  (select user_account_id from p27c_recovery_result),
  (select user_account_id from p27c_accept_result),
  'exact recovery returns the original account'
);
select is(
  (select guide_profile_id from p27c_recovery_result),
  (select guide_profile_id from p27c_accept_result),
  'exact recovery returns the original profile'
);
select is(
  (select pg_catalog.count(*)::integer from audit.audit_event),
  (select audit_count from p27c_before_recovery),
  'exact recovery writes no audit row'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-00000000f001',
      '270c2000-0000-4000-8000-000000000001',
      '270c3000-0000-4000-8000-000000000001',
      '270c-provider-user-new',
      'new.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'recovery with a different invitation id fails closed'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000001',
      '270c2000-0000-4000-8000-00000000f001',
      '270c3000-0000-4000-8000-000000000001',
      '270c-provider-user-new',
      'new.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'recovery with a different verification challenge id fails closed'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000001',
      '270c2000-0000-4000-8000-000000000001',
      '270c3000-0000-4000-8000-00000000f001',
      '270c-provider-user-new',
      'new.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_conflict',
  'recovery with a different provisioning reservation id fails closed'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000001',
      '270c2000-0000-4000-8000-000000000001',
      '270c3000-0000-4000-8000-000000000001',
      'different-provider-user',
      'new.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_conflict',
  'mismatched recovery provider identity fails closed'
);
select is(
  (select pg_catalog.count(*)::integer from audit.audit_event),
  (select audit_count from p27c_before_recovery),
  'mismatched recovery writes no audit row'
);

-- An existing healthy identity receives only the missing Guide role/profile.
insert into identity.user_account (
  user_account_id,
  display_name,
  account_status
) values (
  '270c4000-0000-4000-8000-000000000001',
  'Existing Account Name',
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
  '270c4100-0000-4000-8000-000000000001',
  '270c4000-0000-4000-8000-000000000001',
  'email',
  'primary',
  'existing.guide@example.test',
  'existing.guide@example.test',
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
  '270c4200-0000-4000-8000-000000000001',
  '270c4000-0000-4000-8000-000000000001',
  'supabase',
  '270c-provider-user-existing',
  'existing.guide@example.test',
  'active'
);
insert into core.guide_invite (
  guide_invite_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_name,
  invited_by_user_account_id,
  invite_status,
  expires_at
) values (
  '270c1000-0000-4000-8000-000000000005',
  'existing.guide@example.test',
  'existing.guide@example.test',
  'email',
  'Invitation Name',
  '270c0000-0000-4000-8000-000000000001',
  'created',
  clock_timestamp() + interval '24 hours'
);
insert into identity.verification_challenge (
  verification_challenge_id,
  user_account_id,
  user_contact_method_id,
  normalized_contact_value,
  contact_method_type,
  purpose,
  delivery_channel,
  expires_at,
  used_at
) values (
  '270c2000-0000-4000-8000-000000000005',
  '270c4000-0000-4000-8000-000000000001',
  '270c4100-0000-4000-8000-000000000001',
  'existing.guide@example.test',
  'email',
  'login',
  'email',
  clock_timestamp() + interval '10 minutes',
  clock_timestamp()
);
insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  guide_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  '270c3000-0000-4000-8000-000000000005',
  '270c1000-0000-4000-8000-000000000005',
  'supabase',
  now(),
  now() + interval '24 hours',
  'security_log'
);

create temporary table p27c_existing_result as
select *
  from public.solmind_accept_guide_invitation(
    '270c1000-0000-4000-8000-000000000005',
    '270c2000-0000-4000-8000-000000000005',
    '270c3000-0000-4000-8000-000000000005',
    '270c-provider-user-existing',
    'existing.guide@example.test'
  );

select is(
  (select outcome from p27c_existing_result),
  'accepted',
  'existing identity receives first-time Guide acceptance'
);
select is(
  (select user_account_id from p27c_existing_result),
  '270c4000-0000-4000-8000-000000000001'::uuid,
  'existing identity path returns the existing account'
);
select ok(
  (select guide_profile_id is not null from p27c_existing_result),
  'existing identity path returns the new Guide profile'
);
select is(
  (
    select account.display_name
      from identity.user_account account
     where account.user_account_id =
       '270c4000-0000-4000-8000-000000000001'
  ),
  'Existing Account Name',
  'existing identity path preserves the account display name'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_role_assignment assignment
     where assignment.user_account_id =
       '270c4000-0000-4000-8000-000000000001'
       and assignment.role_code = 'guide'
       and assignment.role_status = 'active'
  ),
  1,
  'existing identity path adds one active Guide role'
);
select is(
  (
    select profile.setup_status
      from core.guide_profile profile
     where profile.guide_profile_id =
       (select guide_profile_id from p27c_existing_result)
  ),
  'profile_pending',
  'existing identity path adds a profile_pending Guide profile'
);
select is(
  (
    select provider_identity.provisioning_reservation_id
      from identity.auth_provider_identity provider_identity
     where provider_identity.auth_provider_identity_id =
       '270c4200-0000-4000-8000-000000000001'
  ),
  null::uuid,
  'existing provider binding remains unchanged and is not rebound'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.actor_user_account_id =
       '270c4000-0000-4000-8000-000000000001'
       and event.reason_code = 'invitation_accepted'
  ),
  3,
  'existing identity path audits only role, profile, and invite changes'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.actor_user_account_id =
       '270c4000-0000-4000-8000-000000000001'
       and event.event_type in (
         'account_provisioned',
         'contact_method_changed',
         'auth_provider_identity_bound'
       )
  ),
  0,
  'existing identity no-op entities write no creation audit rows'
);

-- Exact recovery never reactivates an unhealthy account, contact, provider,
-- Guide role, or Guide profile.
create temporary table p27c_before_unhealthy_recovery as
select pg_catalog.count(*)::integer as audit_count
  from audit.audit_event;

update identity.user_account
   set account_status = 'suspended'
 where user_account_id = '270c4000-0000-4000-8000-000000000001';
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000005',
      '270c2000-0000-4000-8000-000000000005',
      '270c3000-0000-4000-8000-000000000005',
      '270c-provider-user-existing',
      'existing.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'recovery denies a suspended account'
);
select is(
  (
    select account_status
      from identity.user_account
     where user_account_id = '270c4000-0000-4000-8000-000000000001'
  ),
  'suspended',
  'recovery does not reactivate a suspended account'
);
update identity.user_account
   set account_status = 'active'
 where user_account_id = '270c4000-0000-4000-8000-000000000001';

update identity.user_contact_method
   set login_enabled = false,
       status = 'disabled'
 where user_contact_method_id = '270c4100-0000-4000-8000-000000000001';
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000005',
      '270c2000-0000-4000-8000-000000000005',
      '270c3000-0000-4000-8000-000000000005',
      '270c-provider-user-existing',
      'existing.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'recovery denies a disabled login contact'
);
select is(
  (
    select status
      from identity.user_contact_method
     where user_contact_method_id = '270c4100-0000-4000-8000-000000000001'
  ),
  'disabled',
  'recovery does not reactivate a disabled contact'
);
update identity.user_contact_method
   set status = 'active',
       login_enabled = true
 where user_contact_method_id = '270c4100-0000-4000-8000-000000000001';

update identity.auth_provider_identity
   set status = 'disabled'
 where auth_provider_identity_id = '270c4200-0000-4000-8000-000000000001';
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000005',
      '270c2000-0000-4000-8000-000000000005',
      '270c3000-0000-4000-8000-000000000005',
      '270c-provider-user-existing',
      'existing.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_conflict',
  'recovery denies a disabled provider binding'
);
select is(
  (
    select status
      from identity.auth_provider_identity
     where auth_provider_identity_id = '270c4200-0000-4000-8000-000000000001'
  ),
  'disabled',
  'recovery does not reactivate a disabled provider binding'
);
update identity.auth_provider_identity
   set status = 'active'
 where auth_provider_identity_id = '270c4200-0000-4000-8000-000000000001';

update identity.user_role_assignment
   set role_status = 'suspended'
 where user_account_id = '270c4000-0000-4000-8000-000000000001'
   and role_code = 'guide';
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000005',
      '270c2000-0000-4000-8000-000000000005',
      '270c3000-0000-4000-8000-000000000005',
      '270c-provider-user-existing',
      'existing.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'recovery denies a suspended Guide role'
);
select is(
  (
    select role_status
      from identity.user_role_assignment
     where user_account_id = '270c4000-0000-4000-8000-000000000001'
       and role_code = 'guide'
  ),
  'suspended',
  'recovery does not reactivate a suspended Guide role'
);
update identity.user_role_assignment
   set role_status = 'active'
 where user_account_id = '270c4000-0000-4000-8000-000000000001'
   and role_code = 'guide';

update core.guide_profile
   set status = 'inactive'
 where user_account_id = '270c4000-0000-4000-8000-000000000001';
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000005',
      '270c2000-0000-4000-8000-000000000005',
      '270c3000-0000-4000-8000-000000000005',
      '270c-provider-user-existing',
      'existing.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'recovery denies an inactive Guide profile'
);
select is(
  (
    select status
      from core.guide_profile
     where user_account_id = '270c4000-0000-4000-8000-000000000001'
  ),
  'inactive',
  'recovery does not reactivate an inactive Guide profile'
);
update core.guide_profile
   set status = 'active'
 where user_account_id = '270c4000-0000-4000-8000-000000000001';

select is(
  (select pg_catalog.count(*)::integer from audit.audit_event),
  (select audit_count from p27c_before_unhealthy_recovery),
  'all unhealthy recovery denials write no audit row'
);

-- Stale first-time evidence is denied before provisioning.
insert into core.guide_invite (
  guide_invite_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_name,
  invited_by_user_account_id,
  invite_status,
  expires_at
) values (
  '270c1000-0000-4000-8000-000000000003',
  'stale.guide@example.test',
  'stale.guide@example.test',
  'email',
  'Stale Guide',
  '270c0000-0000-4000-8000-000000000001',
  'created',
  clock_timestamp() + interval '24 hours'
);
insert into identity.verification_challenge (
  verification_challenge_id,
  normalized_contact_value,
  contact_method_type,
  purpose,
  delivery_channel,
  expires_at,
  used_at
) values (
  '270c2000-0000-4000-8000-000000000003',
  'stale.guide@example.test',
  'email',
  'contact_verify',
  'email',
  clock_timestamp() + interval '10 minutes',
  clock_timestamp() - interval '30 minutes'
);
insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  guide_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  '270c3000-0000-4000-8000-000000000003',
  '270c1000-0000-4000-8000-000000000003',
  'supabase',
  now(),
  now() + interval '24 hours',
  'security_log'
);
create temporary table p27c_before_stale as
select pg_catalog.count(*)::integer as audit_count
  from audit.audit_event;
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000003',
      '270c2000-0000-4000-8000-000000000003',
      '270c3000-0000-4000-8000-000000000003',
      '270c-provider-user-stale',
      'stale.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_stale_evidence',
  'stale first-time evidence fails closed'
);
select is(
  (
    select invitation.invite_status
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       '270c1000-0000-4000-8000-000000000003'
  ),
  'created',
  'stale denial leaves invitation unchanged'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_account account
     where account.display_name = 'Stale Guide'
  ),
  0,
  'stale denial creates no account'
);
select is(
  (select pg_catalog.count(*)::integer from audit.audit_event),
  (select audit_count from p27c_before_stale),
  'stale denial writes no audit row'
);

-- A provider identity already bound to another account is never merged or
-- rebound by invitation acceptance.
insert into identity.user_account (
  user_account_id,
  display_name,
  account_status
) values (
  '270c5000-0000-4000-8000-000000000001',
  'Foreign Provider Account',
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
  '270c5200-0000-4000-8000-000000000001',
  '270c5000-0000-4000-8000-000000000001',
  'supabase',
  'p27c-provider-foreign-bound',
  'foreign-bound@example.test',
  'active'
);
insert into core.guide_invite (
  guide_invite_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_name,
  invited_by_user_account_id,
  invite_status,
  expires_at
) values (
  '270c1000-0000-4000-8000-000000000010',
  'foreign-bound@example.test',
  'foreign-bound@example.test',
  'email',
  'Foreign Bound Guide',
  '270c0000-0000-4000-8000-000000000001',
  'created',
  clock_timestamp() + interval '24 hours'
);
insert into identity.verification_challenge (
  verification_challenge_id,
  normalized_contact_value,
  contact_method_type,
  purpose,
  delivery_channel,
  expires_at,
  used_at
) values (
  '270c2000-0000-4000-8000-000000000010',
  'foreign-bound@example.test',
  'email',
  'contact_verify',
  'email',
  clock_timestamp() + interval '10 minutes',
  clock_timestamp()
);
insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  guide_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  '270c3000-0000-4000-8000-000000000010',
  '270c1000-0000-4000-8000-000000000010',
  'supabase',
  now(),
  now() + interval '24 hours',
  'security_log'
);
create temporary table p27c_before_foreign_provider as
select pg_catalog.count(*)::integer as audit_count
  from audit.audit_event;
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000010',
      '270c2000-0000-4000-8000-000000000010',
      '270c3000-0000-4000-8000-000000000010',
      'p27c-provider-foreign-bound',
      'foreign-bound@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_conflict',
  'provider identity bound to another account receives fixed conflict'
);
select is(
  (
    select invitation.invite_status
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       '270c1000-0000-4000-8000-000000000010'
  ),
  'created',
  'foreign-provider conflict leaves invitation unchanged'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       '270c2000-0000-4000-8000-000000000010'
  ),
  0,
  'foreign-provider conflict consumes no evidence'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_profile profile
     where profile.user_account_id =
       '270c5000-0000-4000-8000-000000000001'
  ),
  0,
  'foreign-provider conflict creates no Guide profile'
);
select is(
  (select pg_catalog.count(*)::integer from audit.audit_event),
  (select audit_count from p27c_before_foreign_provider),
  'foreign-provider conflict writes no audit row'
);

-- Terminal and already-accepted links remain fixed, writeless denials under
-- repeated clicks unless the exact accepted recovery invariants are present.
insert into core.guide_invite (
  guide_invite_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_name,
  invited_by_user_account_id,
  invite_status,
  expires_at,
  accepted_by_user_account_id,
  accepted_at,
  revoked_at,
  failed_at
) values
(
  '270c1000-0000-4000-8000-000000000011',
  'lifecycle-accepted@example.test',
  'lifecycle-accepted@example.test',
  'email',
  'Lifecycle Accepted',
  '270c0000-0000-4000-8000-000000000001',
  'accepted',
  clock_timestamp() + interval '24 hours',
  '270c0000-0000-4000-8000-000000000001',
  clock_timestamp(),
  null,
  null
),
(
  '270c1000-0000-4000-8000-000000000012',
  'lifecycle-expired@example.test',
  'lifecycle-expired@example.test',
  'email',
  'Lifecycle Expired',
  '270c0000-0000-4000-8000-000000000001',
  'expired',
  clock_timestamp() - interval '1 minute',
  null,
  null,
  null,
  null
),
(
  '270c1000-0000-4000-8000-000000000013',
  'lifecycle-revoked@example.test',
  'lifecycle-revoked@example.test',
  'email',
  'Lifecycle Revoked',
  '270c0000-0000-4000-8000-000000000001',
  'revoked',
  clock_timestamp() + interval '24 hours',
  null,
  null,
  clock_timestamp(),
  null
),
(
  '270c1000-0000-4000-8000-000000000014',
  'lifecycle-failed@example.test',
  'lifecycle-failed@example.test',
  'email',
  'Lifecycle Failed',
  '270c0000-0000-4000-8000-000000000001',
  'failed',
  clock_timestamp() + interval '24 hours',
  null,
  null,
  null,
  clock_timestamp()
);

insert into identity.verification_challenge (
  verification_challenge_id,
  normalized_contact_value,
  contact_method_type,
  purpose,
  delivery_channel,
  expires_at,
  used_at
) values
(
  '270c2000-0000-4000-8000-000000000011',
  'lifecycle-accepted@example.test',
  'email',
  'contact_verify',
  'email',
  clock_timestamp() + interval '10 minutes',
  clock_timestamp()
),
(
  '270c2000-0000-4000-8000-000000000012',
  'lifecycle-expired@example.test',
  'email',
  'contact_verify',
  'email',
  clock_timestamp() + interval '10 minutes',
  clock_timestamp()
),
(
  '270c2000-0000-4000-8000-000000000013',
  'lifecycle-revoked@example.test',
  'email',
  'contact_verify',
  'email',
  clock_timestamp() + interval '10 minutes',
  clock_timestamp()
),
(
  '270c2000-0000-4000-8000-000000000014',
  'lifecycle-failed@example.test',
  'email',
  'contact_verify',
  'email',
  clock_timestamp() + interval '10 minutes',
  clock_timestamp()
);

insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  guide_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values
(
  '270c3000-0000-4000-8000-000000000011',
  '270c1000-0000-4000-8000-000000000011',
  'supabase',
  now(),
  now() + interval '24 hours',
  'security_log'
),
(
  '270c3000-0000-4000-8000-000000000012',
  '270c1000-0000-4000-8000-000000000012',
  'supabase',
  now(),
  now() + interval '24 hours',
  'security_log'
),
(
  '270c3000-0000-4000-8000-000000000013',
  '270c1000-0000-4000-8000-000000000013',
  'supabase',
  now(),
  now() + interval '24 hours',
  'security_log'
),
(
  '270c3000-0000-4000-8000-000000000014',
  '270c1000-0000-4000-8000-000000000014',
  'supabase',
  now(),
  now() + interval '24 hours',
  'security_log'
);

create temporary table p27c_before_lifecycle as
select pg_catalog.count(*)::integer as audit_count
  from audit.audit_event;

select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000011',
      '270c2000-0000-4000-8000-000000000011',
      '270c3000-0000-4000-8000-000000000011',
      'p27c-provider-lifecycle-accepted',
      'lifecycle-accepted@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'accepted link without exact recovery evidence is denied'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000011',
      '270c2000-0000-4000-8000-000000000011',
      '270c3000-0000-4000-8000-000000000011',
      'p27c-provider-lifecycle-accepted',
      'lifecycle-accepted@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'repeated non-recoverable accepted link remains denied'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000012',
      '270c2000-0000-4000-8000-000000000012',
      '270c3000-0000-4000-8000-000000000012',
      'p27c-provider-lifecycle-expired',
      'lifecycle-expired@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'expired link is denied'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000012',
      '270c2000-0000-4000-8000-000000000012',
      '270c3000-0000-4000-8000-000000000012',
      'p27c-provider-lifecycle-expired',
      'lifecycle-expired@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'repeated expired link remains denied'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000013',
      '270c2000-0000-4000-8000-000000000013',
      '270c3000-0000-4000-8000-000000000013',
      'p27c-provider-lifecycle-revoked',
      'lifecycle-revoked@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'revoked link is denied'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000013',
      '270c2000-0000-4000-8000-000000000013',
      '270c3000-0000-4000-8000-000000000013',
      'p27c-provider-lifecycle-revoked',
      'lifecycle-revoked@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'repeated revoked link remains denied'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000014',
      '270c2000-0000-4000-8000-000000000014',
      '270c3000-0000-4000-8000-000000000014',
      'p27c-provider-lifecycle-failed',
      'lifecycle-failed@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'failed link is denied'
);
select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000014',
      '270c2000-0000-4000-8000-000000000014',
      '270c3000-0000-4000-8000-000000000014',
      'p27c-provider-lifecycle-failed',
      'lifecycle-failed@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'repeated failed link remains denied'
);
select is(
  (
    select pg_catalog.string_agg(
             invitation.invite_status,
             ',' order by invitation.guide_invite_id
           )
      from core.guide_invite invitation
     where invitation.guide_invite_id in (
       '270c1000-0000-4000-8000-000000000011',
       '270c1000-0000-4000-8000-000000000012',
       '270c1000-0000-4000-8000-000000000013',
       '270c1000-0000-4000-8000-000000000014'
     )
  ),
  'accepted,expired,revoked,failed',
  'repeated lifecycle denials preserve every terminal status'
);
select is(
  (select pg_catalog.count(*)::integer from audit.audit_event),
  (select audit_count from p27c_before_lifecycle),
  'repeated lifecycle denials write no audit row'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id in (
       '270c2000-0000-4000-8000-000000000011',
       '270c2000-0000-4000-8000-000000000012',
       '270c2000-0000-4000-8000-000000000013',
       '270c2000-0000-4000-8000-000000000014'
     )
  ),
  0,
  'repeated lifecycle denials consume no evidence'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_identity provider_identity
     where provider_identity.provider_user_id like 'p27c-provider-lifecycle-%'
  ),
  0,
  'repeated lifecycle denials create no provider binding'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_account account
     where account.display_name like 'Lifecycle %'
  ),
  0,
  'repeated lifecycle denials create no account'
);

-- Audit failure must roll back every state change in the acceptance statement.
insert into core.guide_invite (
  guide_invite_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_name,
  invited_by_user_account_id,
  invite_status,
  expires_at
) values (
  '270c1000-0000-4000-8000-000000000004',
  'rollback.guide@example.test',
  'rollback.guide@example.test',
  'email',
  'Rollback Guide',
  '270c0000-0000-4000-8000-000000000001',
  'created',
  clock_timestamp() + interval '24 hours'
);
insert into identity.verification_challenge (
  verification_challenge_id,
  normalized_contact_value,
  contact_method_type,
  purpose,
  delivery_channel,
  expires_at,
  used_at
) values (
  '270c2000-0000-4000-8000-000000000004',
  'rollback.guide@example.test',
  'email',
  'contact_verify',
  'email',
  clock_timestamp() + interval '10 minutes',
  clock_timestamp()
);
insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  guide_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  '270c3000-0000-4000-8000-000000000004',
  '270c1000-0000-4000-8000-000000000004',
  'supabase',
  now(),
  now() + interval '24 hours',
  'security_log'
);
create function pg_temp.p27c_reject_audit()
returns trigger
language plpgsql
as $$
begin
  raise exception 'synthetic_p27c_audit_failure';
end;
$$;
create trigger p27c_reject_audit
before insert on audit.audit_event
for each row execute function pg_temp.p27c_reject_audit();

select throws_ok(
  $$select * from public.solmind_accept_guide_invitation(
      '270c1000-0000-4000-8000-000000000004',
      '270c2000-0000-4000-8000-000000000004',
      '270c3000-0000-4000-8000-000000000004',
      '270c-provider-user-rollback',
      'rollback.guide@example.test'
    )$$,
  'P0001',
  'solmind_guide_accept_integrity_failure',
  'audit failure surfaces only the fixed integrity error'
);
drop trigger p27c_reject_audit on audit.audit_event;

select is(
  (
    select invitation.invite_status
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       '270c1000-0000-4000-8000-000000000004'
  ),
  'created',
  'audit failure rolls back invitation acceptance'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_account account
     where account.display_name = 'Rollback Guide'
  ),
  0,
  'audit failure rolls back account provisioning'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       '270c2000-0000-4000-8000-000000000004'
  ),
  0,
  'audit failure rolls back evidence consumption'
);

select * from finish();
rollback;
