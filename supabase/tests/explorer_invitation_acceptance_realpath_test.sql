begin;
create extension if not exists pgtap;
select plan(80);

insert into identity.user_account (
  user_account_id,
  display_name,
  account_status
) values
  (
    'a27e0027-0000-4000-8000-000000000001',
    'S02E synthetic Admin',
    'active'
  ),
  (
    'a27e0027-0000-4000-8000-000000000101',
    'S02E Guide One',
    'active'
  ),
  (
    'a27e0027-0000-4000-8000-000000000102',
    'S02E Guide Two',
    'active'
  ),
  (
    'a27e0027-0000-4000-8000-000000000201',
    'S02E Existing Explorer',
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
    'a27e0027-1000-4000-8000-000000000001',
    'a27e0027-0000-4000-8000-000000000001',
    'admin',
    'active',
    'system'
  ),
  (
    'a27e0027-1000-4000-8000-000000000101',
    'a27e0027-0000-4000-8000-000000000101',
    'guide',
    'active',
    'system'
  ),
  (
    'a27e0027-1000-4000-8000-000000000102',
    'a27e0027-0000-4000-8000-000000000102',
    'guide',
    'active',
    'system'
  ),
  (
    'a27e0027-1000-4000-8000-000000000201',
    'a27e0027-0000-4000-8000-000000000201',
    'explorer',
    'active',
    'system'
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
  status
) values (
  'a27e0027-2000-4000-8000-000000000201',
  'a27e0027-0000-4000-8000-000000000201',
  'email',
  'primary',
  'existing.explorer@synthetic.invalid',
  'existing.explorer@synthetic.invalid',
  true,
  true,
  pg_catalog.clock_timestamp() - interval '1 hour',
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
  'a27e0027-2100-4000-8000-000000000201',
  'a27e0027-0000-4000-8000-000000000201',
  'supabase',
  's02e-provider-existing',
  'existing.explorer@synthetic.invalid',
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
  'a27e0027-3000-4000-8000-000000000001',
  'S02E synthetic organization',
  'approved',
  'a27e0027-0000-4000-8000-000000000001',
  pg_catalog.clock_timestamp() - interval '1 day',
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
  'a27e0027-3100-4000-8000-000000000001',
  'a27e0027-3000-4000-8000-000000000001',
  'S02E synthetic practice',
  'approved',
  'a27e0027-0000-4000-8000-000000000001',
  pg_catalog.clock_timestamp() - interval '1 day',
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
) values
  (
    'a27e0027-3200-4000-8000-000000000101',
    'a27e0027-0000-4000-8000-000000000101',
    'S02E Guide One',
    'approved',
    'a27e0027-0000-4000-8000-000000000001',
    pg_catalog.clock_timestamp() - interval '1 day',
    'active'
  ),
  (
    'a27e0027-3200-4000-8000-000000000102',
    'a27e0027-0000-4000-8000-000000000102',
    'S02E Guide Two',
    'approved',
    'a27e0027-0000-4000-8000-000000000001',
    pg_catalog.clock_timestamp() - interval '1 day',
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
    'a27e0027-3300-4000-8000-000000000101',
    'a27e0027-3100-4000-8000-000000000001',
    'a27e0027-3200-4000-8000-000000000101',
    'active',
    true,
    'a27e0027-0000-4000-8000-000000000001'
  ),
  (
    'a27e0027-3300-4000-8000-000000000102',
    'a27e0027-3100-4000-8000-000000000001',
    'a27e0027-3200-4000-8000-000000000102',
    'active',
    true,
    'a27e0027-0000-4000-8000-000000000001'
  );

insert into core.explorer_profile (
  explorer_profile_id,
  user_account_id,
  explorer_display_name,
  onboarding_status,
  status
) values (
  'a27e0027-3400-4000-8000-000000000201',
  'a27e0027-0000-4000-8000-000000000201',
  'S02E Existing Explorer',
  'active',
  'active'
);

-- The structural index normally prevents this historical duplicate. Dropping
-- it inside the rolled-back test transaction proves defensive sibling
-- revocation remains exact.
drop index core.explorer_invite_one_open_scope_idx;

insert into core.explorer_invite (
  explorer_invite_id,
  guide_profile_id,
  practice_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_name,
  invite_status,
  expires_at,
  sent_at
) values
  (
    'a27e0027-5000-4000-8000-000000000001',
    'a27e0027-3200-4000-8000-000000000101',
    'a27e0027-3100-4000-8000-000000000001',
    'new.explorer@synthetic.invalid',
    'new.explorer@synthetic.invalid',
    'email',
    E'  New\tExplorer  ',
    'sent',
    pg_catalog.clock_timestamp() + interval '1 day',
    pg_catalog.clock_timestamp()
  ),
  (
    'a27e0027-5000-4000-8000-000000000002',
    'a27e0027-3200-4000-8000-000000000101',
    'a27e0027-3100-4000-8000-000000000001',
    'new.explorer@synthetic.invalid',
    'new.explorer@synthetic.invalid',
    'email',
    'Older sibling',
    'created',
    pg_catalog.clock_timestamp() + interval '1 day',
    null
  ),
  (
    'a27e0027-5000-4000-8000-000000000003',
    'a27e0027-3200-4000-8000-000000000102',
    'a27e0027-3100-4000-8000-000000000001',
    'new.explorer@synthetic.invalid',
    'new.explorer@synthetic.invalid',
    'email',
    'Different Guide sibling',
    'created',
    pg_catalog.clock_timestamp() + interval '1 day',
    null
  );

insert into identity.verification_challenge (
  verification_challenge_id,
  normalized_contact_value,
  contact_method_type,
  purpose,
  delivery_channel,
  code_hash,
  expires_at,
  used_at
) values (
  'a27e0027-6000-4000-8000-000000000001',
  'new.explorer@synthetic.invalid',
  'email',
  'contact_verify',
  'email',
  'svf1:0101010101010101010101010101010101010101010101010101010101010101',
  pg_catalog.clock_timestamp() + interval '10 minutes',
  pg_catalog.clock_timestamp()
);

insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  explorer_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  'a27e0027-7000-4000-8000-000000000001',
  'a27e0027-5000-4000-8000-000000000001',
  'supabase',
  pg_catalog.now(),
  pg_catalog.now() + interval '24 hours',
  'security_log'
);

create temporary table s02e_new_result as
select *
  from public.solmind_accept_explorer_invitation(
    'a27e0027-5000-4000-8000-000000000001',
    'a27e0027-6000-4000-8000-000000000001',
    'a27e0027-7000-4000-8000-000000000001',
    's02e-provider-new',
    'new.explorer@synthetic.invalid'
  );

select is(
  (select outcome from s02e_new_result),
  'accepted',
  'new Explorer acceptance returns accepted'
);
select ok(
  (select user_account_id is not null from s02e_new_result),
  'new Explorer acceptance returns an account id'
);
select ok(
  (select explorer_profile_id is not null from s02e_new_result),
  'new Explorer acceptance returns an Explorer profile id'
);
select ok(
  (select guide_explorer_relationship_id is not null from s02e_new_result),
  'new Explorer acceptance returns a relationship id'
);
select is(
  (
    select account.display_name
      from identity.user_account account
     where account.user_account_id =
       (select user_account_id from s02e_new_result)
  ),
  'New Explorer',
  'new Explorer account uses the sanitized invitation display name'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_contact_method contact
     where contact.user_account_id =
       (select user_account_id from s02e_new_result)
       and contact.contact_method_type = 'email'
       and contact.normalized_contact_value =
           'new.explorer@synthetic.invalid'
       and contact.status = 'active'
       and contact.is_verified
       and contact.login_enabled
  ),
  1,
  'new Explorer receives exactly one active verified login contact'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_identity provider_identity
     where provider_identity.user_account_id =
       (select user_account_id from s02e_new_result)
       and provider_identity.provider_name = 'supabase'
       and provider_identity.provider_user_id = 's02e-provider-new'
       and provider_identity.provider_email =
           'new.explorer@synthetic.invalid'
       and provider_identity.provisioning_reservation_id =
           'a27e0027-7000-4000-8000-000000000001'
       and provider_identity.status = 'active'
  ),
  1,
  'new Explorer receives one reservation-correlated provider binding'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_role_assignment assignment
     where assignment.user_account_id =
       (select user_account_id from s02e_new_result)
       and assignment.role_code = 'explorer'
       and assignment.role_status = 'active'
  ),
  1,
  'new Explorer receives exactly one active Explorer role'
);
select is(
  (
    select profile.onboarding_status
      from core.explorer_profile profile
     where profile.explorer_profile_id =
       (select explorer_profile_id from s02e_new_result)
  ),
  'consent_pending',
  'new Explorer profile starts at consent_pending'
);
select is(
  (
    select relationship.relationship_status
      from core.guide_explorer_relationship relationship
     where relationship.guide_explorer_relationship_id =
       (select guide_explorer_relationship_id from s02e_new_result)
  ),
  'intake_pending',
  'acceptance creates an intake_pending relationship'
);
select is(
  (
    select relationship.started_at
      from core.guide_explorer_relationship relationship
     where relationship.guide_explorer_relationship_id =
       (select guide_explorer_relationship_id from s02e_new_result)
  ),
  null::timestamptz,
  'intake_pending relationship keeps started_at null'
);
select is(
  (
    select relationship.created_by_user_account_id
      from core.guide_explorer_relationship relationship
     where relationship.guide_explorer_relationship_id =
       (select guide_explorer_relationship_id from s02e_new_result)
  ),
  (select user_account_id from s02e_new_result),
  'relationship creator is the accepted Explorer account'
);
select is(
  (
    select relationship.created_from_invite_id
      from core.guide_explorer_relationship relationship
     where relationship.guide_explorer_relationship_id =
       (select guide_explorer_relationship_id from s02e_new_result)
  ),
  'a27e0027-5000-4000-8000-000000000001'::uuid,
  'relationship preserves exact invitation provenance'
);
select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27e0027-5000-4000-8000-000000000001'
  ),
  'accepted',
  'accepted invitation becomes accepted'
);
select is(
  (
    select invitation.accepted_by_user_account_id
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27e0027-5000-4000-8000-000000000001'
  ),
  (select user_account_id from s02e_new_result),
  'accepted invitation pins the accepted Explorer account'
);
select is(
  (
    select consumption.consumer_type
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       'a27e0027-6000-4000-8000-000000000001'
  ),
  'explorer_invitation_acceptance',
  'acceptance consumes the exact evidence for the Explorer consumer'
);
select is(
  (
    select consumption.consumer_record_id
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       'a27e0027-6000-4000-8000-000000000001'
  ),
  'a27e0027-5000-4000-8000-000000000001'::uuid,
  'evidence consumption pins the accepted invitation'
);
select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27e0027-5000-4000-8000-000000000002'
  ),
  'revoked',
  'open same-scope sibling is revoked'
);
select ok(
  (
    select invitation.revoked_at is not null
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27e0027-5000-4000-8000-000000000002'
  ),
  'revoked sibling receives a revocation timestamp'
);
select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27e0027-5000-4000-8000-000000000003'
  ),
  'created',
  'same-contact invitation for a different Guide is not displaced'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.reason_code = 'invitation_accepted'
       and event.actor_user_account_id =
           (select user_account_id from s02e_new_result)
  ),
  7,
  'new acceptance writes the seven exact accepted-invitation audit rows'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.reason_code = 'superseded_by_acceptance'
       and event.target_entity_id =
           'a27e0027-5000-4000-8000-000000000002'
  ),
  1,
  'one exact sibling-revocation audit row is written'
);
select set_eq(
  $$
    select
      event.event_type,
      event.actor_user_account_id,
      event.actor_role_context,
      event.target_entity_type,
      event.target_entity_id,
      event.action,
      event.reason_code,
      event.event_summary,
      event.metadata
      from audit.audit_event event
     where event.reason_code in (
       'invitation_accepted', 'superseded_by_acceptance'
     )
  $$,
  $$
    select *
      from (
        values
          (
            'account_provisioned'::text,
            (select user_account_id from s02e_new_result),
            'explorer'::text,
            'user_account'::text,
            (select user_account_id from s02e_new_result),
            'create'::text,
            'invitation_accepted'::text,
            'Account provisioned from invitation.'::text,
            '{}'::jsonb
          ),
          (
            'contact_method_changed'::text,
            (select user_account_id from s02e_new_result),
            'explorer'::text,
            'user_contact_method'::text,
            (
              select contact.user_contact_method_id
                from identity.user_contact_method contact
               where contact.user_account_id =
                 (select user_account_id from s02e_new_result)
                and contact.normalized_contact_value =
                  'new.explorer@synthetic.invalid'
            ),
            'activate'::text,
            'invitation_accepted'::text,
            'Contact method activated from invitation.'::text,
            '{"contact_method_type":"email"}'::jsonb
          ),
          (
            'auth_provider_identity_bound'::text,
            (select user_account_id from s02e_new_result),
            'explorer'::text,
            'auth_provider_identity'::text,
            (
              select provider_identity.auth_provider_identity_id
                from identity.auth_provider_identity provider_identity
               where provider_identity.user_account_id =
                 (select user_account_id from s02e_new_result)
                and provider_identity.provider_name = 'supabase'
            ),
            'bind'::text,
            'invitation_accepted'::text,
            'Provider identity bound from invitation.'::text,
            '{"provider_name":"supabase"}'::jsonb
          ),
          (
            'role_assignment_changed'::text,
            (select user_account_id from s02e_new_result),
            'explorer'::text,
            'user_role_assignment'::text,
            (
              select assignment.user_role_assignment_id
                from identity.user_role_assignment assignment
               where assignment.user_account_id =
                 (select user_account_id from s02e_new_result)
                and assignment.role_code = 'explorer'
            ),
            'grant'::text,
            'invitation_accepted'::text,
            'Role assignment granted from invitation.'::text,
            '{"role_code":"explorer"}'::jsonb
          ),
          (
            'profile_created'::text,
            (select user_account_id from s02e_new_result),
            'explorer'::text,
            'explorer_profile'::text,
            (select explorer_profile_id from s02e_new_result),
            'create'::text,
            'invitation_accepted'::text,
            'Profile created from invitation.'::text,
            '{"profile_type":"explorer"}'::jsonb
          ),
          (
            'invite_accepted'::text,
            (select user_account_id from s02e_new_result),
            'explorer'::text,
            'explorer_invite'::text,
            'a27e0027-5000-4000-8000-000000000001'::uuid,
            'accept'::text,
            'invitation_accepted'::text,
            'Invitation accepted.'::text,
            '{}'::jsonb
          ),
          (
            'guide_explorer_relationship_created'::text,
            (select user_account_id from s02e_new_result),
            'explorer'::text,
            'guide_explorer_relationship'::text,
            (select guide_explorer_relationship_id from s02e_new_result),
            'create'::text,
            'invitation_accepted'::text,
            'Guide-Explorer relationship created from invitation.'::text,
            '{}'::jsonb
          ),
          (
            'invite_revoked'::text,
            null::uuid,
            'system'::text,
            'explorer_invite'::text,
            'a27e0027-5000-4000-8000-000000000002'::uuid,
            'revoke'::text,
            'superseded_by_acceptance'::text,
            'Sibling invitation revoked after acceptance.'::text,
            '{}'::jsonb
          )
      ) expected(
        event_type,
        actor_user_account_id,
        actor_role_context,
        target_entity_type,
        target_entity_id,
        action,
        reason_code,
        event_summary,
        metadata
      )
  $$,
  'new acceptance and sibling revocation emit the full exact audit set'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.reason_code in (
       'invitation_accepted', 'superseded_by_acceptance'
     )
       and event.metadata::text like '%s02e-provider-new%'
  ),
  0,
  'acceptance audit metadata does not expose provider-user identifiers'
);

create temporary table s02e_before_recovery as
select pg_catalog.count(*)::integer as audit_count
  from audit.audit_event;

create temporary table s02e_recovery_result as
select *
  from public.solmind_accept_explorer_invitation(
    'a27e0027-5000-4000-8000-000000000001',
    'a27e0027-6000-4000-8000-000000000001',
    'a27e0027-7000-4000-8000-000000000001',
    's02e-provider-new',
    'new.explorer@synthetic.invalid'
  );

select is(
  (select outcome from s02e_recovery_result),
  'existing',
  'exact retry returns existing'
);
select is(
  (select user_account_id from s02e_recovery_result),
  (select user_account_id from s02e_new_result),
  'exact retry returns the original account id'
);
select is(
  (select explorer_profile_id from s02e_recovery_result),
  (select explorer_profile_id from s02e_new_result),
  'exact retry returns the original Explorer profile id'
);
select is(
  (select guide_explorer_relationship_id from s02e_recovery_result),
  (select guide_explorer_relationship_id from s02e_new_result),
  'exact retry returns the original relationship id'
);
select is(
  (select pg_catalog.count(*)::integer from audit.audit_event),
  (select audit_count from s02e_before_recovery),
  'exact recovery writes no additional audit row'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_explorer_relationship relationship
     where relationship.created_from_invite_id =
       'a27e0027-5000-4000-8000-000000000001'
  ),
  1,
  'exact recovery leaves exactly one relationship'
);

-- Recovery is keyed to the committed challenge and remains available after
-- evidence freshness expires, but it still fails closed when any committed
-- challenge or relationship invariant no longer matches.
update identity.verification_challenge
   set used_at = pg_catalog.clock_timestamp() - interval '10 years'
 where verification_challenge_id =
       'a27e0027-6000-4000-8000-000000000001';
create temporary table s02e_stale_recovery_result as
select *
  from public.solmind_accept_explorer_invitation(
    'a27e0027-5000-4000-8000-000000000001',
    'a27e0027-6000-4000-8000-000000000001',
    'a27e0027-7000-4000-8000-000000000001',
    's02e-provider-new',
    'new.explorer@synthetic.invalid'
  );
select is(
  (select outcome from s02e_stale_recovery_result),
  'existing',
  'exact recovery remains available after evidence freshness expires'
);
select is(
  (select pg_catalog.count(*)::integer from audit.audit_event),
  (select audit_count from s02e_before_recovery),
  'post-freshness exact recovery remains audit-writeless'
);

update identity.verification_challenge
   set purpose = 'role_reentry'
 where verification_challenge_id =
       'a27e0027-6000-4000-8000-000000000001';
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000001',
      'a27e0027-6000-4000-8000-000000000001',
      'a27e0027-7000-4000-8000-000000000001',
      's02e-provider-new',
      'new.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_ineligible',
  'exact recovery denies a challenge with a non-acceptance purpose'
);
update identity.verification_challenge
   set purpose = 'login',
       user_account_id =
         (select user_account_id from s02e_new_result),
       user_contact_method_id = null
 where verification_challenge_id =
       'a27e0027-6000-4000-8000-000000000001';
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000001',
      'a27e0027-6000-4000-8000-000000000001',
      'a27e0027-7000-4000-8000-000000000001',
      's02e-provider-new',
      'new.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_ineligible',
  'exact recovery denies an incomplete account-bound challenge'
);
update identity.verification_challenge
   set user_account_id = null,
       user_contact_method_id = null
 where verification_challenge_id =
       'a27e0027-6000-4000-8000-000000000001';
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000001',
      'a27e0027-6000-4000-8000-000000000001',
      'a27e0027-7000-4000-8000-000000000001',
      's02e-provider-new',
      'new.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_ineligible',
  'exact recovery denies an unbound login challenge'
);
update identity.verification_challenge
   set purpose = 'contact_verify',
       user_account_id = null,
       user_contact_method_id = null
 where verification_challenge_id =
       'a27e0027-6000-4000-8000-000000000001';

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
) values (
  'a27e0027-6000-4000-8000-000000000002',
  (select user_account_id from s02e_new_result),
  (
    select contact.user_contact_method_id
      from identity.user_contact_method contact
     where contact.user_account_id =
       (select user_account_id from s02e_new_result)
      and contact.normalized_contact_value =
        'new.explorer@synthetic.invalid'
  ),
  'new.explorer@synthetic.invalid',
  'email',
  'login',
  'email',
  'svf1:0202020202020202020202020202020202020202020202020202020202020202',
  pg_catalog.clock_timestamp() + interval '10 minutes',
  pg_catalog.clock_timestamp()
);
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000001',
      'a27e0027-6000-4000-8000-000000000002',
      'a27e0027-7000-4000-8000-000000000001',
      's02e-provider-new',
      'new.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_ineligible',
  'accepted invitation cannot recover through a different challenge'
);

update core.guide_explorer_relationship
   set relationship_status = 'paused'
 where guide_explorer_relationship_id =
       (select guide_explorer_relationship_id from s02e_new_result);
create temporary table s02e_paused_recovery_result as
select *
  from public.solmind_accept_explorer_invitation(
    'a27e0027-5000-4000-8000-000000000001',
    'a27e0027-6000-4000-8000-000000000001',
    'a27e0027-7000-4000-8000-000000000001',
    's02e-provider-new',
    'new.explorer@synthetic.invalid'
  );
select is(
  (select outcome from s02e_paused_recovery_result),
  'existing',
  'exact recovery returns the committed relationship after it is paused'
);
update core.guide_explorer_relationship
   set relationship_status = 'ended',
       ended_at = pg_catalog.clock_timestamp()
 where guide_explorer_relationship_id =
       (select guide_explorer_relationship_id from s02e_new_result);
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000001',
      'a27e0027-6000-4000-8000-000000000001',
      'a27e0027-7000-4000-8000-000000000001',
      's02e-provider-new',
      'new.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_ineligible',
  'exact recovery denies an ended committed relationship'
);
select is(
  (select pg_catalog.count(*)::integer from audit.audit_event),
  (select audit_count from s02e_before_recovery),
  'all recovery-state denials remain audit-writeless'
);
update core.guide_explorer_relationship
   set relationship_status = 'paused',
       ended_at = null
 where guide_explorer_relationship_id =
       (select guide_explorer_relationship_id from s02e_new_result);

-- Existing healthy Explorer identity is reused and receives only the new
-- relationship and acceptance-owned audit rows.
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
) values (
  'a27e0027-5000-4000-8000-000000000010',
  'a27e0027-3200-4000-8000-000000000102',
  'a27e0027-3100-4000-8000-000000000001',
  'existing.explorer@synthetic.invalid',
  'existing.explorer@synthetic.invalid',
  'email',
  'Existing Explorer',
  'created',
  pg_catalog.clock_timestamp() + interval '1 day'
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
) values (
  'a27e0027-6000-4000-8000-000000000010',
  'a27e0027-0000-4000-8000-000000000201',
  'a27e0027-2000-4000-8000-000000000201',
  'existing.explorer@synthetic.invalid',
  'email',
  'login',
  'email',
  'svf1:1010101010101010101010101010101010101010101010101010101010101010',
  pg_catalog.clock_timestamp() + interval '10 minutes',
  pg_catalog.clock_timestamp()
);
insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  explorer_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  'a27e0027-7000-4000-8000-000000000010',
  'a27e0027-5000-4000-8000-000000000010',
  'supabase',
  pg_catalog.now(),
  pg_catalog.now() + interval '24 hours',
  'security_log'
);

create temporary table s02e_existing_before as
select pg_catalog.count(*)::integer as audit_count
  from audit.audit_event;
create temporary table s02e_existing_result as
select *
  from public.solmind_accept_explorer_invitation(
    'a27e0027-5000-4000-8000-000000000010',
    'a27e0027-6000-4000-8000-000000000010',
    'a27e0027-7000-4000-8000-000000000010',
    's02e-provider-existing',
    'existing.explorer@synthetic.invalid'
  );

select is(
  (select outcome from s02e_existing_result),
  'accepted',
  'existing healthy Explorer acceptance returns accepted'
);
select is(
  (select user_account_id from s02e_existing_result),
  'a27e0027-0000-4000-8000-000000000201'::uuid,
  'existing Explorer acceptance reuses the account'
);
select is(
  (select explorer_profile_id from s02e_existing_result),
  'a27e0027-3400-4000-8000-000000000201'::uuid,
  'existing Explorer acceptance reuses the profile'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_explorer_relationship relationship
     where relationship.explorer_profile_id =
       'a27e0027-3400-4000-8000-000000000201'
       and relationship.guide_profile_id =
       'a27e0027-3200-4000-8000-000000000102'
       and relationship.relationship_status = 'intake_pending'
  ),
  1,
  'existing Explorer receives one intake_pending Guide Two relationship'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
  ),
  (select audit_count + 2 from s02e_existing_before),
  'existing healthy identity writes only invite and relationship audit rows'
);
update core.guide_explorer_relationship
   set relationship_status = 'ended',
       ended_at = pg_catalog.clock_timestamp()
 where guide_explorer_relationship_id =
       (select guide_explorer_relationship_id from s02e_existing_result);

-- A paused existing Explorer re-enters through the helper-owned transition and
-- acceptance emits the exact additional onboarding audit row.
update core.explorer_profile
   set onboarding_status = 'paused'
 where explorer_profile_id =
       'a27e0027-3400-4000-8000-000000000201';
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
) values (
  'a27e0027-5000-4000-8000-000000000011',
  'a27e0027-3200-4000-8000-000000000101',
  'a27e0027-3100-4000-8000-000000000001',
  'existing.explorer@synthetic.invalid',
  'existing.explorer@synthetic.invalid',
  'email',
  'Replacement Name Must Not Apply',
  'created',
  pg_catalog.clock_timestamp() + interval '1 day'
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
) values (
  'a27e0027-6000-4000-8000-000000000011',
  'a27e0027-0000-4000-8000-000000000201',
  'a27e0027-2000-4000-8000-000000000201',
  'existing.explorer@synthetic.invalid',
  'email',
  'login',
  'email',
  'svf1:1111111111111111111111111111111111111111111111111111111111111111',
  pg_catalog.clock_timestamp() + interval '10 minutes',
  pg_catalog.clock_timestamp()
);
insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  explorer_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  'a27e0027-7000-4000-8000-000000000011',
  'a27e0027-5000-4000-8000-000000000011',
  'supabase',
  pg_catalog.now(),
  pg_catalog.now() + interval '24 hours',
  'security_log'
);
create temporary table s02e_reentry_before as
select pg_catalog.count(*)::integer as audit_count
  from audit.audit_event;
create temporary table s02e_reentry_result as
select *
  from public.solmind_accept_explorer_invitation(
    'a27e0027-5000-4000-8000-000000000011',
    'a27e0027-6000-4000-8000-000000000011',
    'a27e0027-7000-4000-8000-000000000011',
    's02e-provider-existing',
    'existing.explorer@synthetic.invalid'
  );
select is(
  (select outcome from s02e_reentry_result),
  'accepted',
  'paused existing Explorer acceptance returns accepted'
);
select is(
  (
    select profile.onboarding_status
      from core.explorer_profile profile
     where profile.explorer_profile_id =
       'a27e0027-3400-4000-8000-000000000201'
  ),
  'consent_pending',
  'paused existing Explorer re-enters at consent_pending'
);
select is(
  (select pg_catalog.count(*)::integer from audit.audit_event),
  (select audit_count + 3 from s02e_reentry_before),
  're-entry writes only onboarding, invitation, and relationship audit rows'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.event_type = 'profile_onboarding_changed'
       and event.actor_user_account_id =
         'a27e0027-0000-4000-8000-000000000201'
       and event.actor_role_context = 'explorer'
       and event.target_entity_type = 'explorer_profile'
       and event.target_entity_id =
         'a27e0027-3400-4000-8000-000000000201'
       and event.action = 'update'
       and event.reason_code = 'invitation_accepted'
       and event.event_summary =
         'Explorer onboarding status updated after invitation acceptance.'
       and event.metadata = '{}'::jsonb
  ),
  1,
  're-entry emits the exact profile-onboarding audit row'
);

-- Capacity denial is generic during preparation and authoritative during
-- acceptance; both paths remain writeless.
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
  'a27e0027-5000-4000-8000-000000000020',
  'a27e0027-3200-4000-8000-000000000102',
  'a27e0027-3100-4000-8000-000000000001',
  'existing.explorer@synthetic.invalid',
  'existing.explorer@synthetic.invalid',
  'email',
  'created',
  pg_catalog.clock_timestamp() + interval '1 day'
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
) values (
  'a27e0027-6000-4000-8000-000000000020',
  'a27e0027-0000-4000-8000-000000000201',
  'a27e0027-2000-4000-8000-000000000201',
  'existing.explorer@synthetic.invalid',
  'email',
  'login',
  'email',
  'svf1:2020202020202020202020202020202020202020202020202020202020202020',
  pg_catalog.clock_timestamp() + interval '10 minutes',
  pg_catalog.clock_timestamp()
);

create temporary table s02e_capacity_before as
select
  (select pg_catalog.count(*)::integer
     from identity.auth_provider_provisioning_reservation) as reservation_count,
  (select pg_catalog.count(*)::integer
     from audit.audit_event) as audit_count;

select throws_ok(
  $$select * from public.solmind_prepare_explorer_invitation_acceptance(
      'a27e0027-5000-4000-8000-000000000020',
      'a27e0027-6000-4000-8000-000000000020',
      'existing.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_invitation_prepare_ineligible',
  'preparation maps capacity denial to generic ineligible'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_provisioning_reservation
  ),
  (select reservation_count from s02e_capacity_before),
  'preparation capacity denial creates no reservation'
);
select is(
  (select pg_catalog.count(*)::integer from audit.audit_event),
  (select audit_count from s02e_capacity_before),
  'preparation capacity denial writes no audit row'
);

insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  explorer_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  'a27e0027-7000-4000-8000-000000000020',
  'a27e0027-5000-4000-8000-000000000020',
  'supabase',
  pg_catalog.now(),
  pg_catalog.now() + interval '24 hours',
  'security_log'
);

select throws_ok(
  $$select * from public.solmind_prepare_explorer_invitation_acceptance(
      'a27e0027-5000-4000-8000-000000000020',
      'a27e0027-6000-4000-8000-000000000020',
      'existing.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_invitation_prepare_ineligible',
  'exact reservation retry at capacity remains generically denied'
);

select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000020',
      'a27e0027-6000-4000-8000-000000000020',
      'a27e0027-7000-4000-8000-000000000020',
      's02e-provider-existing',
      'existing.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_capacity_reached',
  'acceptance returns the fixed authoritative capacity error'
);
select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27e0027-5000-4000-8000-000000000020'
  ),
  'created',
  'capacity denial leaves the invitation open'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption
     where verification_challenge_id =
       'a27e0027-6000-4000-8000-000000000020'
  ),
  0,
  'capacity denial consumes no evidence'
);

-- Same-Guide counted relationship conflict has deterministic precedence over
-- the broader capacity denial.
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
  'a27e0027-5000-4000-8000-000000000021',
  'a27e0027-3200-4000-8000-000000000101',
  'a27e0027-3100-4000-8000-000000000001',
  'existing.explorer@synthetic.invalid',
  'existing.explorer@synthetic.invalid',
  'email',
  'created',
  pg_catalog.clock_timestamp() + interval '1 day'
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
) values (
  'a27e0027-6000-4000-8000-000000000021',
  'a27e0027-0000-4000-8000-000000000201',
  'a27e0027-2000-4000-8000-000000000201',
  'existing.explorer@synthetic.invalid',
  'email',
  'login',
  'email',
  'svf1:2121212121212121212121212121212121212121212121212121212121212121',
  pg_catalog.clock_timestamp() + interval '10 minutes',
  pg_catalog.clock_timestamp()
);
insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  explorer_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  'a27e0027-7000-4000-8000-000000000021',
  'a27e0027-5000-4000-8000-000000000021',
  'supabase',
  pg_catalog.now(),
  pg_catalog.now() + interval '24 hours',
  'security_log'
);

select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000021',
      'a27e0027-6000-4000-8000-000000000021',
      'a27e0027-7000-4000-8000-000000000021',
      's02e-provider-existing',
      'existing.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_conflict',
  'same-Guide counted relationship returns conflict before capacity'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption
     where verification_challenge_id =
       'a27e0027-6000-4000-8000-000000000021'
  ),
  0,
  'same-pair conflict consumes no evidence'
);

-- Missing protected capacity policy fails closed before provisioning.
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
  'a27e0027-5000-4000-8000-000000000030',
  'a27e0027-3200-4000-8000-000000000101',
  'a27e0027-3100-4000-8000-000000000001',
  'policy.explorer@synthetic.invalid',
  'policy.explorer@synthetic.invalid',
  'email',
  'created',
  pg_catalog.clock_timestamp() + interval '1 day'
);
insert into identity.verification_challenge (
  verification_challenge_id,
  normalized_contact_value,
  contact_method_type,
  purpose,
  delivery_channel,
  code_hash,
  expires_at,
  used_at
) values (
  'a27e0027-6000-4000-8000-000000000030',
  'policy.explorer@synthetic.invalid',
  'email',
  'contact_verify',
  'email',
  'svf1:3030303030303030303030303030303030303030303030303030303030303030',
  pg_catalog.clock_timestamp() + interval '10 minutes',
  pg_catalog.clock_timestamp()
);
insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  explorer_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  'a27e0027-7000-4000-8000-000000000030',
  'a27e0027-5000-4000-8000-000000000030',
  'supabase',
  pg_catalog.now(),
  pg_catalog.now() + interval '24 hours',
  'security_log'
);

create temporary table s02e_saved_capacity_policy as
select *
  from core.explorer_engagement_capacity_policy
 where capacity_policy_name = 'current_guide_relationship_maximum';
delete from core.explorer_engagement_capacity_policy
 where capacity_policy_name = 'current_guide_relationship_maximum';

select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000030',
      'a27e0027-6000-4000-8000-000000000030',
      'a27e0027-7000-4000-8000-000000000030',
      's02e-provider-policy',
      'policy.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_policy_unavailable',
  'missing capacity policy returns the fixed policy-unavailable error'
);
select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27e0027-5000-4000-8000-000000000030'
  ),
  'created',
  'policy denial leaves the invitation open'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption
     where verification_challenge_id =
       'a27e0027-6000-4000-8000-000000000030'
  ),
  0,
  'policy denial consumes no evidence'
);

insert into core.explorer_engagement_capacity_policy
select * from s02e_saved_capacity_policy;

-- Missing protected freshness policy fails closed independently of the
-- capacity-policy failure class and before provisioning.
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
  'a27e0027-5000-4000-8000-000000000031',
  'a27e0027-3200-4000-8000-000000000101',
  'a27e0027-3100-4000-8000-000000000001',
  'freshness.policy.explorer@synthetic.invalid',
  'freshness.policy.explorer@synthetic.invalid',
  'email',
  'created',
  pg_catalog.clock_timestamp() + interval '1 day'
);
insert into identity.verification_challenge (
  verification_challenge_id,
  normalized_contact_value,
  contact_method_type,
  purpose,
  delivery_channel,
  code_hash,
  expires_at,
  used_at
) values (
  'a27e0027-6000-4000-8000-000000000031',
  'freshness.policy.explorer@synthetic.invalid',
  'email',
  'contact_verify',
  'email',
  'svf1:3131313131313131313131313131313131313131313131313131313131313131',
  pg_catalog.clock_timestamp() + interval '10 minutes',
  pg_catalog.clock_timestamp()
);
insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  explorer_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  'a27e0027-7000-4000-8000-000000000031',
  'a27e0027-5000-4000-8000-000000000031',
  'supabase',
  pg_catalog.now(),
  pg_catalog.now() + interval '24 hours',
  'security_log'
);
create temporary table s02e_saved_freshness_policy as
select *
  from identity.invitation_acceptance_freshness_policy
 where policy_name = 'invitation_acceptance_evidence_freshness';
delete from identity.invitation_acceptance_freshness_policy
 where policy_name = 'invitation_acceptance_evidence_freshness';
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000031',
      'a27e0027-6000-4000-8000-000000000031',
      'a27e0027-7000-4000-8000-000000000031',
      's02e-provider-freshness-policy',
      'freshness.policy.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_policy_unavailable',
  'missing freshness policy returns the fixed policy-unavailable error'
);
select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27e0027-5000-4000-8000-000000000031'
  ),
  'created',
  'freshness-policy denial leaves the invitation open'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       'a27e0027-6000-4000-8000-000000000031'
  ),
  0,
  'freshness-policy denial consumes no evidence'
);
insert into identity.invitation_acceptance_freshness_policy
select * from s02e_saved_freshness_policy;

-- Prepare a paused existing-identity call so the induced-failure matrix also
-- reaches the conditional profile-onboarding audit insert.
update core.guide_explorer_relationship
   set relationship_status = 'ended',
       ended_at = pg_catalog.clock_timestamp()
 where guide_explorer_relationship_id =
       (select guide_explorer_relationship_id from s02e_reentry_result);
update core.explorer_profile
   set onboarding_status = 'paused'
 where explorer_profile_id =
       'a27e0027-3400-4000-8000-000000000201';
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
  'a27e0027-5000-4000-8000-000000000041',
  'a27e0027-3200-4000-8000-000000000101',
  'a27e0027-3100-4000-8000-000000000001',
  'existing.explorer@synthetic.invalid',
  'existing.explorer@synthetic.invalid',
  'email',
  'created',
  pg_catalog.clock_timestamp() + interval '1 day'
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
) values (
  'a27e0027-6000-4000-8000-000000000041',
  'a27e0027-0000-4000-8000-000000000201',
  'a27e0027-2000-4000-8000-000000000201',
  'existing.explorer@synthetic.invalid',
  'email',
  'login',
  'email',
  'svf1:4141414141414141414141414141414141414141414141414141414141414141',
  pg_catalog.clock_timestamp() + interval '10 minutes',
  pg_catalog.clock_timestamp()
);
insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  explorer_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  'a27e0027-7000-4000-8000-000000000041',
  'a27e0027-5000-4000-8000-000000000041',
  'supabase',
  pg_catalog.now(),
  pg_catalog.now() + interval '24 hours',
  'security_log'
);

-- Audit failure rolls back every acceptance-owned state change.
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
    'a27e0027-5000-4000-8000-000000000040',
    'a27e0027-3200-4000-8000-000000000101',
    'a27e0027-3100-4000-8000-000000000001',
    'rollback.explorer@synthetic.invalid',
    'rollback.explorer@synthetic.invalid',
    'email',
    'Rollback Explorer',
    'created',
    pg_catalog.clock_timestamp() + interval '1 day'
  ),
  (
    'a27e0027-5000-4000-8000-000000000042',
    'a27e0027-3200-4000-8000-000000000101',
    'a27e0027-3100-4000-8000-000000000001',
    'rollback.explorer@synthetic.invalid',
    'rollback.explorer@synthetic.invalid',
    'email',
    'Rollback sibling',
    'created',
    pg_catalog.clock_timestamp() + interval '1 day'
  );
insert into identity.verification_challenge (
  verification_challenge_id,
  normalized_contact_value,
  contact_method_type,
  purpose,
  delivery_channel,
  code_hash,
  expires_at,
  used_at
) values (
  'a27e0027-6000-4000-8000-000000000040',
  'rollback.explorer@synthetic.invalid',
  'email',
  'contact_verify',
  'email',
  'svf1:4040404040404040404040404040404040404040404040404040404040404040',
  pg_catalog.clock_timestamp() + interval '10 minutes',
  pg_catalog.clock_timestamp()
);
insert into identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id,
  explorer_invite_id,
  provider_name,
  created_at,
  expires_at,
  retention_class
) values (
  'a27e0027-7000-4000-8000-000000000040',
  'a27e0027-5000-4000-8000-000000000040',
  'supabase',
  pg_catalog.now(),
  pg_catalog.now() + interval '24 hours',
  'security_log'
);

create temporary table s02e_rejected_audit_event (
  event_type text primary key
);
insert into s02e_rejected_audit_event (event_type)
values ('profile_onboarding_changed');

create function pg_temp.s02e_reject_audit()
returns trigger
language plpgsql
as $$
begin
  if new.event_type = (
    select rejected.event_type
      from pg_temp.s02e_rejected_audit_event rejected
  ) then
    raise exception 'synthetic_s02e_audit_failure';
  end if;
  return new;
end;
$$;
create trigger s02e_reject_audit
before insert on audit.audit_event
for each row execute function pg_temp.s02e_reject_audit();

select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000041',
      'a27e0027-6000-4000-8000-000000000041',
      'a27e0027-7000-4000-8000-000000000041',
      's02e-provider-existing',
      'existing.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_integrity_failure',
  'profile-onboarding audit failure surfaces only the fixed integrity error'
);
select is(
  (
    select profile.onboarding_status
      from core.explorer_profile profile
     where profile.explorer_profile_id =
       'a27e0027-3400-4000-8000-000000000201'
  ),
  'paused',
  'profile-onboarding audit failure rolls back the re-entry transition'
);
select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27e0027-5000-4000-8000-000000000041'
  ),
  'created',
  'profile-onboarding audit failure rolls back invitation acceptance'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_explorer_relationship relationship
     where relationship.created_from_invite_id =
       'a27e0027-5000-4000-8000-000000000041'
  ),
  0,
  'profile-onboarding audit failure creates no relationship'
);
update s02e_rejected_audit_event
   set event_type = 'account_provisioned';
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000040',
      'a27e0027-6000-4000-8000-000000000040',
      'a27e0027-7000-4000-8000-000000000040',
      's02e-provider-rollback',
      'rollback.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_integrity_failure',
  'account audit failure surfaces only the fixed integrity error'
);
update s02e_rejected_audit_event
   set event_type = 'contact_method_changed';
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000040',
      'a27e0027-6000-4000-8000-000000000040',
      'a27e0027-7000-4000-8000-000000000040',
      's02e-provider-rollback',
      'rollback.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_integrity_failure',
  'contact audit failure surfaces only the fixed integrity error'
);
update s02e_rejected_audit_event
   set event_type = 'auth_provider_identity_bound';
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000040',
      'a27e0027-6000-4000-8000-000000000040',
      'a27e0027-7000-4000-8000-000000000040',
      's02e-provider-rollback',
      'rollback.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_integrity_failure',
  'provider-binding audit failure surfaces only the fixed integrity error'
);
update s02e_rejected_audit_event
   set event_type = 'role_assignment_changed';
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000040',
      'a27e0027-6000-4000-8000-000000000040',
      'a27e0027-7000-4000-8000-000000000040',
      's02e-provider-rollback',
      'rollback.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_integrity_failure',
  'role audit failure surfaces only the fixed integrity error'
);
update s02e_rejected_audit_event
   set event_type = 'profile_created';
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000040',
      'a27e0027-6000-4000-8000-000000000040',
      'a27e0027-7000-4000-8000-000000000040',
      's02e-provider-rollback',
      'rollback.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_integrity_failure',
  'profile audit failure surfaces only the fixed integrity error'
);
update s02e_rejected_audit_event
   set event_type = 'invite_accepted';
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000040',
      'a27e0027-6000-4000-8000-000000000040',
      'a27e0027-7000-4000-8000-000000000040',
      's02e-provider-rollback',
      'rollback.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_integrity_failure',
  'invite audit failure surfaces only the fixed integrity error'
);
update s02e_rejected_audit_event
   set event_type = 'guide_explorer_relationship_created';
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000040',
      'a27e0027-6000-4000-8000-000000000040',
      'a27e0027-7000-4000-8000-000000000040',
      's02e-provider-rollback',
      'rollback.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_integrity_failure',
  'relationship audit failure surfaces only the fixed integrity error'
);
update s02e_rejected_audit_event
   set event_type = 'invite_revoked';
select throws_ok(
  $$select * from public.solmind_accept_explorer_invitation(
      'a27e0027-5000-4000-8000-000000000040',
      'a27e0027-6000-4000-8000-000000000040',
      'a27e0027-7000-4000-8000-000000000040',
      's02e-provider-rollback',
      'rollback.explorer@synthetic.invalid'
    )$$,
  'P0001',
  'solmind_explorer_accept_integrity_failure',
  'sibling-revocation audit failure surfaces only the fixed integrity error'
);
select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27e0027-5000-4000-8000-000000000042'
  ),
  'created',
  'sibling-revocation audit failure rolls back sibling revocation'
);
drop trigger s02e_reject_audit on audit.audit_event;

select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27e0027-5000-4000-8000-000000000040'
  ),
  'created',
  'audit failure rolls back invitation acceptance'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_account account
     where account.display_name = 'Rollback Explorer'
  ),
  0,
  'audit failure rolls back account provisioning'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       'a27e0027-6000-4000-8000-000000000040'
  ),
  0,
  'audit failure rolls back evidence consumption'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_explorer_relationship relationship
     where relationship.created_from_invite_id =
       'a27e0027-5000-4000-8000-000000000040'
  ),
  0,
  'audit failure rolls back relationship creation'
);

select * from finish();
rollback;
