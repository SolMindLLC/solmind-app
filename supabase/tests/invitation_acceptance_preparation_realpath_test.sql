begin;
select plan(49);

insert into identity.user_account (
  user_account_id,
  display_name,
  account_status
) values
  (
    'def50027-1000-4000-8000-000000000001',
    'P27-B synthetic Admin inviter',
    'active'
  ),
  (
    'def50027-1000-4000-8000-000000000002',
    'P27-B synthetic approved Guide',
    'active'
  ),
  (
    'def50027-1000-4000-8000-000000000003',
    'P27-B synthetic existing invitee',
    'active'
  ),
  (
    'def50027-1000-4000-8000-000000000004',
    'P27-B synthetic suspended invitee',
    'suspended'
  ),
  (
    'def50027-1000-4000-8000-000000000005',
    'P27-B synthetic provider-missing invitee',
    'active'
  );

insert into identity.user_role_assignment (
  user_role_assignment_id,
  user_account_id,
  role_code,
  role_status
) values
  (
    'def50027-1100-4000-8000-000000000001',
    'def50027-1000-4000-8000-000000000001',
    'admin',
    'active'
  ),
  (
    'def50027-1100-4000-8000-000000000002',
    'def50027-1000-4000-8000-000000000002',
    'guide',
    'active'
  );

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
  status
) values
  (
    'def50027-1200-4000-8000-000000000001',
    'def50027-1000-4000-8000-000000000003',
    'email',
    'primary',
    'p27b-existing@synthetic.invalid',
    'p27b-existing@synthetic.invalid',
    null,
    null,
    true,
    true,
    clock_timestamp() - interval '1 hour',
    'active'
  ),
  (
    'def50027-1200-4000-8000-000000000002',
    'def50027-1000-4000-8000-000000000003',
    'phone',
    'primary',
    '+15555550127',
    '+15555550127',
    'wireless',
    true,
    true,
    true,
    clock_timestamp() - interval '1 hour',
    'active'
  ),
  (
    'def50027-1200-4000-8000-000000000003',
    'def50027-1000-4000-8000-000000000004',
    'email',
    'primary',
    'p27b-suspended@synthetic.invalid',
    'p27b-suspended@synthetic.invalid',
    null,
    null,
    true,
    true,
    clock_timestamp() - interval '1 hour',
    'active'
  ),
  (
    'def50027-1200-4000-8000-000000000004',
    'def50027-1000-4000-8000-000000000005',
    'email',
    'primary',
    'p27b-no-provider@synthetic.invalid',
    'p27b-no-provider@synthetic.invalid',
    null,
    null,
    true,
    true,
    clock_timestamp() - interval '1 hour',
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
  'def50027-1300-4000-8000-000000000001',
  'def50027-1000-4000-8000-000000000003',
  'supabase',
  'p27b-provider-user-existing',
  'p27b-existing@synthetic.invalid',
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
  'def50027-2000-4000-8000-000000000001',
  'P27-B synthetic organization',
  'approved',
  'def50027-1000-4000-8000-000000000001',
  clock_timestamp() - interval '1 day',
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
) values (
  'def50027-2100-4000-8000-000000000001',
  'def50027-2000-4000-8000-000000000001',
  'P27-B synthetic practice',
  'approved',
  'def50027-1000-4000-8000-000000000001',
  clock_timestamp() - interval '1 day',
  'active'
);

insert into core.guide_profile (
  guide_profile_id,
  user_account_id,
  guide_display_name,
  setup_status,
  approved_by_user_account_id,
  approved_at,
  status
) values (
  'def50027-2200-4000-8000-000000000001',
  'def50027-1000-4000-8000-000000000002',
  'P27-B synthetic Guide',
  'approved',
  'def50027-1000-4000-8000-000000000001',
  clock_timestamp() - interval '1 day',
  'active'
);

insert into core.practice_guide (
  practice_guide_id,
  practice_id,
  guide_profile_id,
  relationship_status,
  is_primary_for_mvp0,
  created_by_user_account_id
) values (
  'def50027-2300-4000-8000-000000000001',
  'def50027-2100-4000-8000-000000000001',
  'def50027-2200-4000-8000-000000000001',
  'active',
  true,
  'def50027-1000-4000-8000-000000000001'
);

insert into core.guide_invite (
  guide_invite_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_by_user_account_id,
  invite_status,
  expires_at,
  sent_at
) values
  (
    'def50027-3000-4000-8000-000000000001',
    'p27b-new-guide@synthetic.invalid',
    'p27b-new-guide@synthetic.invalid',
    'email',
    'def50027-1000-4000-8000-000000000001',
    'sent',
    clock_timestamp() + interval '1 day',
    clock_timestamp()
  ),
  (
    'def50027-3000-4000-8000-000000000002',
    'p27b-existing@synthetic.invalid',
    'p27b-existing@synthetic.invalid',
    'email',
    'def50027-1000-4000-8000-000000000001',
    'created',
    clock_timestamp() + interval '1 day',
    null
  ),
  (
    'def50027-3000-4000-8000-000000000003',
    'p27b-bad-purpose@synthetic.invalid',
    'p27b-bad-purpose@synthetic.invalid',
    'email',
    'def50027-1000-4000-8000-000000000001',
    'created',
    clock_timestamp() + interval '1 day',
    null
  ),
  (
    'def50027-3000-4000-8000-000000000004',
    'p27b-consumed@synthetic.invalid',
    'p27b-consumed@synthetic.invalid',
    'email',
    'def50027-1000-4000-8000-000000000001',
    'created',
    clock_timestamp() + interval '1 day',
    null
  ),
  (
    'def50027-3000-4000-8000-000000000005',
    'p27b-policy@synthetic.invalid',
    'p27b-policy@synthetic.invalid',
    'email',
    'def50027-1000-4000-8000-000000000001',
    'created',
    clock_timestamp() + interval '1 day',
    null
  ),
  (
    'def50027-3000-4000-8000-000000000006',
    'p27b-audit@synthetic.invalid',
    'p27b-audit@synthetic.invalid',
    'email',
    'def50027-1000-4000-8000-000000000001',
    'created',
    clock_timestamp() + interval '1 day',
    null
  ),
  (
    'def50027-3000-4000-8000-000000000007',
    '+15555550199',
    '+15555550199',
    'phone',
    'def50027-1000-4000-8000-000000000001',
    'created',
    clock_timestamp() + interval '1 day',
    null
  ),
  (
    'def50027-3000-4000-8000-000000000008',
    'p27b-suspended@synthetic.invalid',
    'p27b-suspended@synthetic.invalid',
    'email',
    'def50027-1000-4000-8000-000000000001',
    'created',
    clock_timestamp() + interval '1 day',
    null
  ),
  (
    'def50027-3000-4000-8000-000000000009',
    'p27b-no-provider@synthetic.invalid',
    'p27b-no-provider@synthetic.invalid',
    'email',
    'def50027-1000-4000-8000-000000000001',
    'created',
    clock_timestamp() + interval '1 day',
    null
  );

insert into core.explorer_invite (
  explorer_invite_id,
  guide_profile_id,
  practice_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invite_status,
  expires_at,
  sent_at
) values
  (
    'def50027-3100-4000-8000-000000000001',
    'def50027-2200-4000-8000-000000000001',
    'def50027-2100-4000-8000-000000000001',
    'p27b-new-explorer@synthetic.invalid',
    'p27b-new-explorer@synthetic.invalid',
    'email',
    'sent',
    clock_timestamp() + interval '1 day',
    clock_timestamp()
  ),
  (
    'def50027-3100-4000-8000-000000000002',
    'def50027-2200-4000-8000-000000000001',
    'def50027-2100-4000-8000-000000000001',
    '+15555550127',
    '+15555550127',
    'phone',
    'created',
    clock_timestamp() + interval '1 day',
    null
  );

insert into identity.verification_challenge (
  verification_challenge_id,
  user_account_id,
  user_contact_method_id,
  normalized_contact_value,
  contact_method_type,
  purpose,
  delivery_channel,
  code_hash,
  expires_at,
  used_at
) values
  (
    'def50027-4000-4000-8000-000000000001',
    null,
    null,
    'p27b-new-guide@synthetic.invalid',
    'email',
    'contact_verify',
    'email',
    'svf1:0101010101010101010101010101010101010101010101010101010101010101',
    clock_timestamp() + interval '10 minutes',
    clock_timestamp()
  ),
  (
    'def50027-4000-4000-8000-000000000002',
    'def50027-1000-4000-8000-000000000003',
    'def50027-1200-4000-8000-000000000001',
    'p27b-existing@synthetic.invalid',
    'email',
    'login',
    'email',
    'svf1:0202020202020202020202020202020202020202020202020202020202020202',
    clock_timestamp() + interval '10 minutes',
    clock_timestamp()
  ),
  (
    'def50027-4000-4000-8000-000000000003',
    null,
    null,
    'p27b-bad-purpose@synthetic.invalid',
    'email',
    'password_reset',
    'email',
    'svf1:0303030303030303030303030303030303030303030303030303030303030303',
    clock_timestamp() + interval '10 minutes',
    clock_timestamp()
  ),
  (
    'def50027-4000-4000-8000-000000000004',
    null,
    null,
    'p27b-consumed@synthetic.invalid',
    'email',
    'contact_verify',
    'email',
    'svf1:0404040404040404040404040404040404040404040404040404040404040404',
    clock_timestamp() + interval '10 minutes',
    clock_timestamp()
  ),
  (
    'def50027-4000-4000-8000-000000000005',
    null,
    null,
    'p27b-policy@synthetic.invalid',
    'email',
    'contact_verify',
    'email',
    'svf1:0505050505050505050505050505050505050505050505050505050505050505',
    clock_timestamp() + interval '10 minutes',
    clock_timestamp()
  ),
  (
    'def50027-4000-4000-8000-000000000006',
    null,
    null,
    'p27b-audit@synthetic.invalid',
    'email',
    'contact_verify',
    'email',
    'svf1:0606060606060606060606060606060606060606060606060606060606060606',
    clock_timestamp() + interval '10 minutes',
    clock_timestamp()
  ),
  (
    'def50027-4000-4000-8000-000000000007',
    null,
    null,
    '+15555550199',
    'phone',
    'contact_verify',
    'sms',
    'svf1:0707070707070707070707070707070707070707070707070707070707070707',
    clock_timestamp() + interval '10 minutes',
    clock_timestamp()
  ),
  (
    'def50027-4000-4000-8000-000000000008',
    'def50027-1000-4000-8000-000000000004',
    'def50027-1200-4000-8000-000000000003',
    'p27b-suspended@synthetic.invalid',
    'email',
    'contact_verify',
    'email',
    'svf1:0808080808080808080808080808080808080808080808080808080808080808',
    clock_timestamp() + interval '10 minutes',
    clock_timestamp()
  ),
  (
    'def50027-4000-4000-8000-000000000009',
    'def50027-1000-4000-8000-000000000005',
    'def50027-1200-4000-8000-000000000004',
    'p27b-no-provider@synthetic.invalid',
    'email',
    'login',
    'email',
    'svf1:0909090909090909090909090909090909090909090909090909090909090909',
    clock_timestamp() + interval '10 minutes',
    clock_timestamp()
  ),
  (
    'def50027-4100-4000-8000-000000000001',
    null,
    null,
    'p27b-new-explorer@synthetic.invalid',
    'email',
    'contact_verify',
    'email',
    'svf1:1111111111111111111111111111111111111111111111111111111111111111',
    clock_timestamp() + interval '10 minutes',
    clock_timestamp()
  ),
  (
    'def50027-4100-4000-8000-000000000002',
    'def50027-1000-4000-8000-000000000003',
    'def50027-1200-4000-8000-000000000002',
    '+15555550127',
    'phone',
    'contact_verify',
    'sms',
    'svf1:1212121212121212121212121212121212121212121212121212121212121212',
    clock_timestamp() + interval '10 minutes',
    clock_timestamp()
  );

insert into identity.authorizing_evidence_consumption (
  verification_challenge_id,
  consumer_type,
  consumer_record_id,
  consumed_at
) values (
  'def50027-4000-4000-8000-000000000004',
  'user_session',
  'def50027-4900-4000-8000-000000000004',
  clock_timestamp()
);

create temp table p27b_unchanged_before as
select
  (select count(*) from identity.user_account) as account_count,
  (select count(*) from identity.user_contact_method) as contact_count,
  (select count(*) from identity.auth_provider_identity) as provider_identity_count,
  (select count(*) from identity.user_role_assignment) as role_count,
  (select count(*) from identity.user_session) as session_count,
  (select count(*) from core.guide_profile) as guide_profile_count,
  (select count(*) from core.explorer_profile) as explorer_profile_count,
  (select count(*) from core.practice_guide) as practice_guide_count,
  (select count(*) from core.guide_explorer_relationship) as relationship_count,
  (select count(*) from core.guide_invite) as guide_invite_count,
  (select count(*) from core.explorer_invite) as explorer_invite_count,
  (select count(*) from identity.authorizing_evidence_consumption) as consumption_count;

set local role service_role;
create temp table p27b_new_guide_result as
select * from public.solmind_prepare_guide_invitation_acceptance(
  'def50027-3000-4000-8000-000000000001',
  'def50027-4000-4000-8000-000000000001',
  'p27b-new-guide@synthetic.invalid'
);
reset role;

select is(
  (select outcome from p27b_new_guide_result),
  'created',
  'fresh pre-account email evidence creates a Guide reservation'
);
select ok(
  (select provisioning_reservation_id is not null from p27b_new_guide_result),
  'Guide preparation returns a database-generated reservation UUID'
);
select results_eq(
  $$select guide_invite_id,explorer_invite_id,provider_name,
           expires_at-created_at,retention_class
      from identity.auth_provider_provisioning_reservation
     where provisioning_reservation_id=(
       select provisioning_reservation_id from p27b_new_guide_result
     )$$,
  $$select 'def50027-3000-4000-8000-000000000001'::uuid,null::uuid,
           'supabase'::text,interval '24 hours','security_log'::text$$,
  'Guide reservation has exact invitation, provider, horizon, and retention'
);
select is(
  (
    select count(*)::integer
      from audit.audit_event
     where target_entity_id = (
       select provisioning_reservation_id from p27b_new_guide_result
     )
  ),
  1,
  'first Guide preparation writes one audit row'
);
select results_eq(
  $$select event_type,action,reason_code,event_summary,actor_user_account_id,
           actor_role_context,target_entity_type,metadata
      from audit.audit_event
     where target_entity_id=(
       select provisioning_reservation_id from p27b_new_guide_result
     )$$,
  $$select 'auth_provider_provisioning_reserved'::text,'reserve'::text,
           'invitation_acceptance_preflight'::text,
           'Auth provider provisioning reserved for invitation acceptance.'::text,
           null::uuid,'system'::text,
           'auth_provider_provisioning_reservation'::text,
           '{"provider_name":"supabase","role_code":"guide"}'::jsonb$$,
  'Guide reservation audit row is exact and bounded'
);
select is(
  (
    select count(*)::integer
      from identity.authorizing_evidence_consumption
     where verification_challenge_id =
       'def50027-4000-4000-8000-000000000001'
  ),
  0,
  'preparation does not consume Guide evidence'
);
select results_eq(
  $$select invite_status,accepted_by_user_account_id,accepted_at,revoked_at
      from core.guide_invite
     where guide_invite_id='def50027-3000-4000-8000-000000000001'$$,
  $$select 'sent'::text,null::uuid,null::timestamptz,null::timestamptz$$,
  'preparation does not mutate the Guide invitation'
);

set local role service_role;
create temp table p27b_new_guide_retry as
select * from public.solmind_prepare_guide_invitation_acceptance(
  'def50027-3000-4000-8000-000000000001',
  'def50027-4000-4000-8000-000000000001',
  'p27b-new-guide@synthetic.invalid'
);
reset role;
select is(
  (select outcome from p27b_new_guide_retry),
  'existing',
  'eligible exact Guide retry returns existing'
);
select is(
  (select provisioning_reservation_id from p27b_new_guide_retry),
  (select provisioning_reservation_id from p27b_new_guide_result),
  'eligible exact Guide retry returns the same reservation UUID'
);
select is(
  (
    select count(*)::integer
      from audit.audit_event
     where target_entity_id = (
       select provisioning_reservation_id from p27b_new_guide_result
     )
  ),
  1,
  'eligible exact Guide retry writes no new audit row'
);

update identity.auth_provider_provisioning_reservation
   set created_at = transaction_timestamp() - interval '25 hours',
       expires_at = transaction_timestamp() - interval '1 hour'
 where provisioning_reservation_id = (
   select provisioning_reservation_id from p27b_new_guide_result
 );
set local role service_role;
select results_eq(
  $$select outcome,provisioning_reservation_id
      from public.solmind_prepare_guide_invitation_acceptance(
        'def50027-3000-4000-8000-000000000001',
        'def50027-4000-4000-8000-000000000001',
        'p27b-new-guide@synthetic.invalid'
      )$$,
  $$select 'existing'::text,provisioning_reservation_id
      from p27b_new_guide_result$$,
  'expired reconciliation horizon is not acceptance authority and does not invalidate an otherwise eligible exact retry'
);
reset role;

update identity.verification_challenge
   set used_at = clock_timestamp() - interval '299 seconds'
 where verification_challenge_id = 'def50027-4000-4000-8000-000000000001';
set local role service_role;
select results_eq(
  $$select outcome,provisioning_reservation_id
      from public.solmind_prepare_guide_invitation_acceptance(
        'def50027-3000-4000-8000-000000000001',
        'def50027-4000-4000-8000-000000000001',
        'p27b-new-guide@synthetic.invalid'
      )$$,
  $$select 'existing'::text,provisioning_reservation_id
      from p27b_new_guide_result$$,
  'fresh evidence just inside the active boundary remains eligible'
);
reset role;

update identity.verification_challenge
   set used_at = clock_timestamp() - interval '301 seconds'
 where verification_challenge_id = 'def50027-4000-4000-8000-000000000001';
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000001',
    'def50027-4000-4000-8000-000000000001',
    'p27b-new-guide@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_stale_evidence',
  'stale evidence blocks even an existing preparation reservation'
);
reset role;
update identity.verification_challenge
   set used_at = clock_timestamp()
 where verification_challenge_id = 'def50027-4000-4000-8000-000000000001';
select is(
  (
    select count(*)::integer
      from identity.auth_provider_provisioning_reservation
     where guide_invite_id = 'def50027-3000-4000-8000-000000000001'
  ),
  1,
  'stale retry preserves the immutable existing reservation without growth'
);

set local role service_role;
create temp table p27b_existing_guide_result as
select * from public.solmind_prepare_guide_invitation_acceptance(
  'def50027-3000-4000-8000-000000000002',
  'def50027-4000-4000-8000-000000000002',
  'p27b-existing@synthetic.invalid'
);
reset role;
select is(
  (select outcome from p27b_existing_guide_result),
  'created',
  'account-bound login evidence may prepare an email Guide invitation'
);
select is(
  (
    select count(*)::integer
      from identity.auth_provider_identity
     where user_account_id = 'def50027-1000-4000-8000-000000000003'
  ),
  1,
  'preparation does not create or alter the existing provider binding'
);

set local role service_role;
create temp table p27b_new_explorer_result as
select * from public.solmind_prepare_explorer_invitation_acceptance(
  'def50027-3100-4000-8000-000000000001',
  'def50027-4100-4000-8000-000000000001',
  'p27b-new-explorer@synthetic.invalid'
);
reset role;
select is(
  (select outcome from p27b_new_explorer_result),
  'created',
  'fresh pre-account email evidence creates an Explorer reservation'
);
select results_eq(
  $$select guide_invite_id,explorer_invite_id,provider_name,
           expires_at-created_at,retention_class
      from identity.auth_provider_provisioning_reservation
     where provisioning_reservation_id=(
       select provisioning_reservation_id from p27b_new_explorer_result
     )$$,
  $$select null::uuid,'def50027-3100-4000-8000-000000000001'::uuid,
           'supabase'::text,interval '24 hours','security_log'::text$$,
  'Explorer reservation has exact invitation, provider, horizon, and retention'
);
select results_eq(
  $$select event_type,action,reason_code,event_summary,actor_user_account_id,
           actor_role_context,target_entity_type,metadata
      from audit.audit_event
     where target_entity_id=(
       select provisioning_reservation_id from p27b_new_explorer_result
     )$$,
  $$select 'auth_provider_provisioning_reserved'::text,'reserve'::text,
           'invitation_acceptance_preflight'::text,
           'Auth provider provisioning reserved for invitation acceptance.'::text,
           null::uuid,'system'::text,
           'auth_provider_provisioning_reservation'::text,
           '{"provider_name":"supabase","role_code":"explorer"}'::jsonb$$,
  'Explorer reservation audit row is exact and bounded'
);
select is(
  (
    select count(*)::integer
      from core.guide_explorer_relationship
     where created_from_invite_id = 'def50027-3100-4000-8000-000000000001'
  ),
  0,
  'Explorer preparation creates no Guide-Explorer relationship'
);
update core.practice_guide
   set relationship_status = 'suspended'
 where practice_guide_id = 'def50027-2300-4000-8000-000000000001';
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_explorer_invitation_acceptance(
    'def50027-3100-4000-8000-000000000001',
    'def50027-4100-4000-8000-000000000001',
    'p27b-new-explorer@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_ineligible',
  'exact Explorer retry revalidates the active Guide-Practice relationship'
);
reset role;
update core.practice_guide
   set relationship_status = 'active'
 where practice_guide_id = 'def50027-2300-4000-8000-000000000001';

set local role service_role;
create temp table p27b_phone_explorer_result as
select * from public.solmind_prepare_explorer_invitation_acceptance(
  'def50027-3100-4000-8000-000000000002',
  'def50027-4100-4000-8000-000000000002',
  'p27b-existing@synthetic.invalid'
);
reset role;
select is(
  (select outcome from p27b_phone_explorer_result),
  'created',
  'account-bound phone invitation may prepare only with matching email anchor'
);
select is(
  (
    select count(*)::integer
      from audit.audit_event
     where target_entity_id = (
       select provisioning_reservation_id from p27b_phone_explorer_result
     )
  ),
  1,
  'existing-account phone preparation writes one reservation audit'
);
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_explorer_invitation_acceptance(
    'def50027-3100-4000-8000-000000000002',
    'def50027-4100-4000-8000-000000000002',
    'wrong-provider-email@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_conflict',
  'account-bound phone preparation denies a provider-email mismatch'
);
reset role;
update identity.user_contact_method
   set status = 'disabled',
       login_enabled = false
 where user_contact_method_id = 'def50027-1200-4000-8000-000000000001';
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_explorer_invitation_acceptance(
    'def50027-3100-4000-8000-000000000002',
    'def50027-4100-4000-8000-000000000002',
    'p27b-existing@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_ineligible',
  'account-bound phone retry denies when its email contact anchor is no longer active'
);
reset role;
update identity.user_contact_method
   set status = 'active',
       login_enabled = true
 where user_contact_method_id = 'def50027-1200-4000-8000-000000000001';

set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000003',
    'def50027-4000-4000-8000-000000000003',
    'p27b-bad-purpose@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_ineligible',
  'password-reset evidence cannot authorize preparation'
);
reset role;
update identity.verification_challenge
   set purpose = 'first_admin_setup'
 where verification_challenge_id = 'def50027-4000-4000-8000-000000000003';
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000003',
    'def50027-4000-4000-8000-000000000003',
    'p27b-bad-purpose@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_ineligible',
  'first-Admin evidence cannot authorize preparation'
);
reset role;
update identity.verification_challenge
   set purpose = 'role_reentry'
 where verification_challenge_id = 'def50027-4000-4000-8000-000000000003';
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000003',
    'def50027-4000-4000-8000-000000000003',
    'p27b-bad-purpose@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_ineligible',
  'role-reentry evidence cannot authorize preparation'
);
reset role;
update identity.verification_challenge
   set purpose = 'login'
 where verification_challenge_id = 'def50027-4000-4000-8000-000000000003';
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000003',
    'def50027-4000-4000-8000-000000000003',
    'p27b-bad-purpose@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_ineligible',
  'pre-account login evidence cannot authorize preparation'
);
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000004',
    'def50027-4000-4000-8000-000000000004',
    'p27b-consumed@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_evidence_consumed',
  'already-consumed evidence cannot authorize preparation'
);
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000007',
    'def50027-4000-4000-8000-000000000007',
    'phone-anchor@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_ineligible',
  'null-bound phone invitation preparation is denied'
);
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000008',
    'def50027-4000-4000-8000-000000000008',
    'p27b-suspended@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_ineligible',
  'inactive existing account cannot prepare invitation acceptance'
);
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000009',
    'def50027-4000-4000-8000-000000000009',
    'p27b-no-provider@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_conflict',
  'account-bound preparation requires one exact active Supabase provider binding'
);
reset role;
select is(
  (
    select count(*)::integer
      from identity.auth_provider_provisioning_reservation
     where guide_invite_id in (
       'def50027-3000-4000-8000-000000000003',
       'def50027-3000-4000-8000-000000000004',
       'def50027-3000-4000-8000-000000000007',
       'def50027-3000-4000-8000-000000000008',
       'def50027-3000-4000-8000-000000000009'
     )
  ),
  0,
  'purpose, consumption, phone-only, inactive-account, and provider-binding denials create no reservation'
);

delete from identity.invitation_acceptance_freshness_policy;
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000005',
    'def50027-4000-4000-8000-000000000005',
    'p27b-policy@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_policy_unavailable',
  'missing freshness policy fails closed'
);
reset role;
select is(
  (
    select count(*)::integer
      from identity.auth_provider_provisioning_reservation
     where guide_invite_id = 'def50027-3000-4000-8000-000000000005'
  ),
  0,
  'policy outage leaves no reservation'
);
insert into identity.invitation_acceptance_freshness_policy (
  policy_name,
  minimum_seconds,
  active_seconds,
  maximum_seconds
) values (
  'invitation_acceptance_evidence_freshness',
  60,
  300,
  600
);

alter table identity.invitation_acceptance_freshness_policy
  drop constraint invitation_acceptance_freshness_policy_values_check;
update identity.invitation_acceptance_freshness_policy
   set minimum_seconds = 600,
       active_seconds = 300,
       maximum_seconds = 60;
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000005',
    'def50027-4000-4000-8000-000000000005',
    'p27b-policy@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_policy_unavailable',
  'malformed freshness policy fails closed'
);
reset role;
update identity.invitation_acceptance_freshness_policy
   set minimum_seconds = 60,
       active_seconds = 300,
       maximum_seconds = 600;
alter table identity.invitation_acceptance_freshness_policy
  add constraint invitation_acceptance_freshness_policy_values_check
  check (
    minimum_seconds > 0
    and minimum_seconds <= active_seconds
    and active_seconds <= maximum_seconds
  );

alter table identity.invitation_acceptance_freshness_policy
  drop constraint invitation_acceptance_freshness_policy_pkey;
insert into identity.invitation_acceptance_freshness_policy (
  policy_name,
  minimum_seconds,
  active_seconds,
  maximum_seconds
) values (
  'invitation_acceptance_evidence_freshness',
  60,
  300,
  600
);
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000005',
    'def50027-4000-4000-8000-000000000005',
    'p27b-policy@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_policy_unavailable',
  'duplicate freshness policy rows fail closed'
);
reset role;
delete from identity.invitation_acceptance_freshness_policy;
insert into identity.invitation_acceptance_freshness_policy (
  policy_name,
  minimum_seconds,
  active_seconds,
  maximum_seconds
) values (
  'invitation_acceptance_evidence_freshness',
  60,
  300,
  600
);
alter table identity.invitation_acceptance_freshness_policy
  add constraint invitation_acceptance_freshness_policy_pkey
  primary key (policy_name);

update core.guide_invite
   set invite_status = 'revoked',
       revoked_at = clock_timestamp()
 where guide_invite_id = 'def50027-3000-4000-8000-000000000005';
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000005',
    'def50027-4000-4000-8000-000000000005',
    'p27b-policy@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_ineligible',
  'terminal revoked invitation denies before provider IO'
);
reset role;
update core.guide_invite
   set invite_status = 'created',
       revoked_at = null
 where guide_invite_id = 'def50027-3000-4000-8000-000000000005';

create temp table p27b_audit_count_before_failure as
select count(*)::bigint as audit_count
  from audit.audit_event
 where event_type = 'auth_provider_provisioning_reserved';

create function pg_temp.p27b_reject_audit()
returns trigger
language plpgsql
as $$
begin
  raise exception 'p27b_induced_audit_failure';
end;
$$;
create trigger p27b_reject_audit
before insert on audit.audit_event
for each row execute function pg_temp.p27b_reject_audit();
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-3000-4000-8000-000000000006',
    'def50027-4000-4000-8000-000000000006',
    'p27b-audit@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_integrity_failure',
  'audit failure maps to the fixed integrity class'
);
reset role;
drop trigger p27b_reject_audit on audit.audit_event;
select is(
  (
    select count(*)::integer
      from identity.auth_provider_provisioning_reservation
     where guide_invite_id = 'def50027-3000-4000-8000-000000000006'
  ),
  0,
  'audit failure rolls back reservation insertion'
);
select is(
  (
    select count(*)::integer
      from audit.audit_event
     where event_type = 'auth_provider_provisioning_reserved'
  ),
  (select audit_count::integer from p27b_audit_count_before_failure),
  'audit failure leaves no partial reservation audit row'
);

select results_eq(
  $$select
       (select count(*) from identity.user_account),
       (select count(*) from identity.user_contact_method),
       (select count(*) from identity.auth_provider_identity),
       (select count(*) from identity.user_role_assignment),
       (select count(*) from identity.user_session),
       (select count(*) from core.guide_profile),
       (select count(*) from core.explorer_profile),
       (select count(*) from core.practice_guide),
       (select count(*) from core.guide_explorer_relationship),
       (select count(*) from core.guide_invite),
       (select count(*) from core.explorer_invite),
       (select count(*) from identity.authorizing_evidence_consumption)$$,
  $$select account_count,contact_count,provider_identity_count,role_count,session_count,
           guide_profile_count,explorer_profile_count,practice_guide_count,
           relationship_count,
           guide_invite_count,explorer_invite_count,consumption_count
      from p27b_unchanged_before$$,
  'all preparation attempts leave every non-reservation product table unchanged'
);
select is(
  (
    select count(*)::integer
      from identity.auth_provider_provisioning_reservation
     where guide_invite_id::text like 'def50027-%'
        or explorer_invite_id::text like 'def50027-%'
  ),
  4,
  'four eligible invitation paths create exactly four reservations'
);
select is(
  (
    select count(*)::integer
      from audit.audit_event
     where event_type = 'auth_provider_provisioning_reserved'
       and target_entity_id in (
         select provisioning_reservation_id
           from identity.auth_provider_provisioning_reservation
          where guide_invite_id::text like 'def50027-%'
             or explorer_invite_id::text like 'def50027-%'
       )
  ),
  4,
  'four first preparations create exactly four reservation audit rows'
);
select is(
  (
    select count(*)::integer
      from audit.audit_event
     where event_type = 'auth_provider_provisioning_reserved'
       and (
         to_jsonb(audit_event)::text like '%synthetic.invalid%'
         or to_jsonb(audit_event)::text like '%+1555555%'
         or to_jsonb(audit_event)::text like '%svf1:%'
       )
  ),
  0,
  'reservation audit excludes contacts, phone values, and verifier sentinels'
);
select is(
  (
    select count(*)::integer
      from audit.audit_event
     where event_type = 'auth_provider_provisioning_reserved'
       and (
         ip_address is not null
         or user_agent is not null
         or actor_user_account_id is not null
       )
  ),
  0,
  'reservation audit has null network fields and null human actor'
);
select results_eq(
  $$select invite_status,count(*)::integer
      from core.guide_invite
     where guide_invite_id::text like 'def50027-%'
     group by invite_status
     order by invite_status$$,
  $$select * from (
       values ('created'::text,8),('sent'::text,1)
     ) expected(invite_status,row_count)$$,
  'Guide preparation leaves every synthetic invitation status unchanged'
);
select results_eq(
  $$select invite_status,count(*)::integer
      from core.explorer_invite
     where explorer_invite_id::text like 'def50027-%'
     group by invite_status
     order by invite_status$$,
  $$select * from (
       values ('created'::text,1),('sent'::text,1)
     ) expected(invite_status,row_count)$$,
  'Explorer preparation leaves every synthetic invitation status unchanged'
);

select * from finish();
rollback;
