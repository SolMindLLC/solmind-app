begin;
select plan(53);

insert into identity.user_account (
  user_account_id,
  display_name,
  account_status
) values
  (
    'a27c0030-0000-4000-8000-000000000101',
    'P27-C Issuance Admin',
    'active'
  ),
  (
    'a27c0030-0000-4000-8000-000000000102',
    'P27-C Non Admin',
    'active'
  );

insert into identity.user_role_assignment (
  user_role_assignment_id,
  user_account_id,
  role_code,
  role_status,
  granted_by_role_context
) values (
  'a27c0030-1000-4000-8000-000000000101',
  'a27c0030-0000-4000-8000-000000000101',
  'admin',
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
    'a27c0030-2000-4000-8000-000000000101',
    'a27c0030-0000-4000-8000-000000000101',
    'admin',
    pg_catalog.now() - interval '1 minute',
    pg_catalog.now() + interval '2 hours',
    'active'
  ),
  (
    'a27c0030-2000-4000-8000-000000000102',
    'a27c0030-0000-4000-8000-000000000102',
    'explorer',
    pg_catalog.now() - interval '1 minute',
    pg_catalog.now() + interval '2 hours',
    'active'
  ),
  (
    'a27c0030-2000-4000-8000-000000000103',
    'a27c0030-0000-4000-8000-000000000101',
    'admin',
    pg_catalog.now() - interval '2 hours',
    pg_catalog.now() - interval '1 minute',
    'expired'
  );

insert into identity.user_account (
  user_account_id,
  display_name,
  account_status
) values
  (
    'a27c0030-0000-4000-8000-000000000201',
    'Existing Active Guide',
    'active'
  ),
  (
    'a27c0030-0000-4000-8000-000000000202',
    'Existing Suspended Guide',
    'suspended'
  ),
  (
    'a27c0030-0000-4000-8000-000000000203',
    'Existing Role Only',
    'active'
  ),
  (
    'a27c0030-0000-4000-8000-000000000204',
    'Existing Profile Only',
    'active'
  ),
  (
    'a27c0030-0000-4000-8000-000000000205',
    'Existing Contact Only',
    'active'
  ),
  (
    'a27c0030-0000-4000-8000-000000000206',
    'Existing Explorer Only',
    'active'
  ),
  (
    'a27c0030-0000-4000-8000-000000000207',
    'Duplicate Contact One',
    'active'
  ),
  (
    'a27c0030-0000-4000-8000-000000000208',
    'Duplicate Contact Two',
    'active'
  ),
  (
    'a27c0030-0000-4000-8000-000000000209',
    'Accepted History Account',
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
  status
) values
  (
    'a27c0030-4000-4000-8000-000000000201',
    'a27c0030-0000-4000-8000-000000000201',
    'email', 'primary',
    'active-guide@synthetic.invalid',
    'active-guide@synthetic.invalid',
    true, true, 'active'
  ),
  (
    'a27c0030-4000-4000-8000-000000000202',
    'a27c0030-0000-4000-8000-000000000202',
    'email', 'primary',
    'suspended-guide@synthetic.invalid',
    'suspended-guide@synthetic.invalid',
    false, false, 'disabled'
  ),
  (
    'a27c0030-4000-4000-8000-000000000203',
    'a27c0030-0000-4000-8000-000000000203',
    'email', 'primary',
    'role-only@synthetic.invalid',
    'role-only@synthetic.invalid',
    false, false, 'pending'
  ),
  (
    'a27c0030-4000-4000-8000-000000000204',
    'a27c0030-0000-4000-8000-000000000204',
    'email', 'primary',
    'profile-only@synthetic.invalid',
    'profile-only@synthetic.invalid',
    false, false, 'pending'
  ),
  (
    'a27c0030-4000-4000-8000-000000000205',
    'a27c0030-0000-4000-8000-000000000205',
    'email', 'primary',
    'contact-only@synthetic.invalid',
    'contact-only@synthetic.invalid',
    false, false, 'pending'
  ),
  (
    'a27c0030-4000-4000-8000-000000000206',
    'a27c0030-0000-4000-8000-000000000206',
    'email', 'primary',
    'explorer-only@synthetic.invalid',
    'explorer-only@synthetic.invalid',
    true, true, 'active'
  ),
  (
    'a27c0030-4000-4000-8000-000000000207',
    'a27c0030-0000-4000-8000-000000000207',
    'email', 'primary',
    'duplicate@synthetic.invalid',
    'duplicate@synthetic.invalid',
    false, false, 'disabled'
  ),
  (
    'a27c0030-4000-4000-8000-000000000208',
    'a27c0030-0000-4000-8000-000000000208',
    'email', 'primary',
    'duplicate@synthetic.invalid',
    'duplicate@synthetic.invalid',
    false, false, 'deleted'
  ),
  (
    'a27c0030-4000-4000-8000-000000000209',
    'a27c0030-0000-4000-8000-000000000209',
    'email', 'primary',
    'accepted-history@synthetic.invalid',
    'accepted-history@synthetic.invalid',
    true, true, 'active'
  );

insert into identity.user_role_assignment (
  user_role_assignment_id,
  user_account_id,
  role_code,
  role_status,
  granted_by_role_context
) values
  (
    'a27c0030-1000-4000-8000-000000000201',
    'a27c0030-0000-4000-8000-000000000201',
    'guide', 'active', 'system'
  ),
  (
    'a27c0030-1000-4000-8000-000000000202',
    'a27c0030-0000-4000-8000-000000000202',
    'guide', 'pending', 'system'
  ),
  (
    'a27c0030-1000-4000-8000-000000000203',
    'a27c0030-0000-4000-8000-000000000203',
    'guide', 'revoked', 'system'
  ),
  (
    'a27c0030-1000-4000-8000-000000000206',
    'a27c0030-0000-4000-8000-000000000206',
    'explorer', 'active', 'system'
  ),
  (
    'a27c0030-1000-4000-8000-000000000207',
    'a27c0030-0000-4000-8000-000000000207',
    'explorer', 'active', 'system'
  ),
  (
    'a27c0030-1000-4000-8000-000000000208',
    'a27c0030-0000-4000-8000-000000000208',
    'explorer', 'active', 'system'
  ),
  (
    'a27c0030-1000-4000-8000-000000000209',
    'a27c0030-0000-4000-8000-000000000209',
    'explorer', 'active', 'system'
  );

insert into core.guide_profile (
  guide_profile_id,
  user_account_id,
  guide_display_name,
  setup_status,
  status
) values
  (
    'a27c0030-5000-4000-8000-000000000201',
    'a27c0030-0000-4000-8000-000000000201',
    'Existing Active Guide',
    'profile_pending',
    'active'
  ),
  (
    'a27c0030-5000-4000-8000-000000000202',
    'a27c0030-0000-4000-8000-000000000202',
    'Existing Suspended Guide',
    'suspended',
    'active'
  ),
  (
    'a27c0030-5000-4000-8000-000000000204',
    'a27c0030-0000-4000-8000-000000000204',
    'Existing Profile Only',
    'changes_requested',
    'inactive'
  );

insert into core.guide_invite (
  guide_invite_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_by_user_account_id,
  invite_status,
  expires_at,
  accepted_by_user_account_id,
  accepted_at
) values (
  'a27c0030-3000-4000-8000-000000000120',
  'accepted-history@synthetic.invalid',
  'accepted-history@synthetic.invalid',
  'email',
  'a27c0030-0000-4000-8000-000000000101',
  'accepted',
  pg_catalog.now() + interval '1 hour',
  'a27c0030-0000-4000-8000-000000000209',
  pg_catalog.now() - interval '1 minute'
);

set local role service_role;
select is(
  (
    select outcome
      from public.solmind_issue_guide_invitation(
        'a27c0030-3000-4000-8000-000000000101',
        'a27c0030-0000-4000-8000-000000000101',
        'a27c0030-2000-4000-8000-000000000101',
        'email',
        'guide-one@synthetic.invalid',
        'guide-one@synthetic.invalid',
        U&'  Guide\200B One  '
      )
  ),
  'issued',
  'active Admin session issues a Guide invitation'
);
reset role;

select ok(
  (
    select row(
      invited_contact_value,
      normalized_contact_value,
      contact_method_type,
      invited_name,
      invited_by_user_account_id,
      invite_status,
      metadata,
      retention_class
    ) is not distinct from row(
      'guide-one@synthetic.invalid'::text,
      'guide-one@synthetic.invalid'::text,
      'email'::text,
      'Guide One'::text,
      'a27c0030-0000-4000-8000-000000000101'::uuid,
      'created'::text,
      '{}'::jsonb,
      'core_business'::text
    )
      from core.guide_invite
     where guide_invite_id = 'a27c0030-3000-4000-8000-000000000101'
  ),
  'inserted invitation fields and sanitized name are exact'
);
select ok(
  (
    select expires_at between
      created_at + interval '23 hours 59 minutes 59 seconds'
      and created_at + interval '24 hours 1 second'
      from core.guide_invite
     where guide_invite_id = 'a27c0030-3000-4000-8000-000000000101'
  ),
  'issuance snapshots the 24-hour active policy'
);
select ok(
  (
    select row(
      event_type,
      actor_user_account_id,
      actor_role_context,
      target_entity_type,
      action,
      reason_code,
      event_summary,
      metadata
    ) is not distinct from row(
      'guide_invite_issued'::text,
      'a27c0030-0000-4000-8000-000000000101'::uuid,
      'admin'::text,
      'guide_invite'::text,
      'issue'::text,
      'admin_issued'::text,
      'Guide invitation issued.'::text,
      '{"lifetime_hours":24,"contact_method_type":"email"}'::jsonb
    )
      from audit.audit_event
     where target_entity_id = 'a27c0030-3000-4000-8000-000000000101'
  ),
  'issuance audit is exact and bounded'
);

set local role service_role;
select is(
  (
    select outcome
      from public.solmind_issue_guide_invitation(
        'a27c0030-3000-4000-8000-000000000101',
        'a27c0030-0000-4000-8000-000000000101',
        'a27c0030-2000-4000-8000-000000000101',
        'email',
        'guide-one@synthetic.invalid',
        'guide-one@synthetic.invalid',
        U&'  Guide\200B One  '
      )
  ),
  'existing',
  'exact response-loss retry is writeless'
);
reset role;
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0030-3000-4000-8000-000000000101'
  ),
  1,
  'exact retry adds no audit row'
);

set local role service_role;
select is(
  (
    select outcome
      from public.solmind_issue_guide_invitation(
        'a27c0030-3000-4000-8000-000000000102',
        'a27c0030-0000-4000-8000-000000000101',
        'a27c0030-2000-4000-8000-000000000101',
        'email',
        'guide-one@synthetic.invalid',
        'guide-one@synthetic.invalid',
        'Guide One Replacement'
      )
  ),
  'issued',
  'replacement issuance succeeds'
);
reset role;
select ok(
  (
    select invite_status = 'revoked' and revoked_at is not null
      from core.guide_invite
     where guide_invite_id = 'a27c0030-3000-4000-8000-000000000101'
  ),
  'prior open invitation is revoked'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite
     where contact_method_type = 'email'
       and normalized_contact_value = 'guide-one@synthetic.invalid'
       and invite_status in ('created', 'sent')
  ),
  1,
  'exactly one Guide invitation remains open'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0030-3000-4000-8000-000000000101'
       and event_type = 'invite_revoked'
       and reason_code = 'superseded_by_reissuance'
  ),
  1,
  'replacement writes one exact revocation audit'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0030-3000-4000-8000-000000000102'
       and event_type = 'guide_invite_issued'
  ),
  1,
  'replacement target has one issuance audit'
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
) values (
  'a27c0030-3000-4000-8000-000000000103',
  'expired@synthetic.invalid',
  'expired@synthetic.invalid',
  'email',
  'a27c0030-0000-4000-8000-000000000101',
  'sent',
  pg_catalog.now() - interval '1 minute',
  pg_catalog.now() - interval '2 hours'
);

set local role service_role;
select is(
  (
    select outcome
      from public.solmind_issue_guide_invitation(
        'a27c0030-3000-4000-8000-000000000104',
        'a27c0030-0000-4000-8000-000000000101',
        'a27c0030-2000-4000-8000-000000000101',
        'email',
        'expired@synthetic.invalid',
        'expired@synthetic.invalid',
        null
      )
  ),
  'issued',
  'issuance materializes prior expiry before insert'
);
reset role;
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0030-3000-4000-8000-000000000103'
  ),
  'expired',
  'stored expired row is materialized'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0030-3000-4000-8000-000000000103'
       and event_type = 'invite_expired'
       and actor_role_context = 'system'
  ),
  1,
  'expiry materialization has one system audit'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.target_entity_id::text like 'a27c0030-3%'
       and (
         pg_catalog.to_jsonb(event)::text like '%synthetic.invalid%'
         or pg_catalog.to_jsonb(event)::text like '%Guide One%'
       )
  ),
  0,
  'audit rows contain no contact or invited name'
);

set local role service_role;
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000105',
    'a27c0030-0000-4000-8000-000000000102',
    'a27c0030-2000-4000-8000-000000000102',
    'email', 'denied@synthetic.invalid', 'denied@synthetic.invalid', null
  )$$,
  'P0001',
  'solmind_guide_issue_unauthorized',
  'non-Admin account and role context deny'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000106',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000103',
    'email', 'expired-session@synthetic.invalid',
    'expired-session@synthetic.invalid', null
  )$$,
  'P0001',
  'solmind_guide_issue_unauthorized',
  'expired Admin session denies'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000107',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000102',
    'email', 'foreign-session@synthetic.invalid',
    'foreign-session@synthetic.invalid', null
  )$$,
  'P0001',
  'solmind_guide_issue_unauthorized',
  'foreign session denies'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000108',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000101',
    'email', 'UPPER@synthetic.invalid', 'UPPER@synthetic.invalid', null
  )$$,
  'P0001',
  'solmind_guide_issue_invalid_contact',
  'noncanonical normalized email denies'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000109',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000101',
    'phone', '+15555550101', '+15555550102', null
  )$$,
  'P0001',
  'solmind_guide_issue_invalid_contact',
  'phone raw and normalized mismatch denies'
);
reset role;
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite
     where guide_invite_id between
       'a27c0030-3000-4000-8000-000000000105'::uuid
       and 'a27c0030-3000-4000-8000-000000000109'::uuid
  ),
  0,
  'all denied calls are writeless'
);

set local role service_role;
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000121',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000101',
    'email', 'active-guide@synthetic.invalid',
    'active-guide@synthetic.invalid', null
  )$$,
  'P0001',
  'solmind_guide_issue_existing_guide',
  'active Guide identity denies new onboarding issuance'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000122',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000101',
    'email', 'suspended-guide@synthetic.invalid',
    'suspended-guide@synthetic.invalid', null
  )$$,
  'P0001',
  'solmind_guide_issue_existing_guide',
  'suspended Guide account and pending Guide role deny issuance'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000123',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000101',
    'email', 'role-only@synthetic.invalid',
    'role-only@synthetic.invalid', null
  )$$,
  'P0001',
  'solmind_guide_issue_existing_guide',
  'revoked Guide-role-only identity denies issuance'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000124',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000101',
    'email', 'profile-only@synthetic.invalid',
    'profile-only@synthetic.invalid', null
  )$$,
  'P0001',
  'solmind_guide_issue_existing_guide',
  'inactive Guide-profile-only identity denies issuance'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000125',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000101',
    'email', 'contact-only@synthetic.invalid',
    'contact-only@synthetic.invalid', null
  )$$,
  'P0001',
  'solmind_guide_issue_existing_guide',
  'account/contact-only contradictory identity denies issuance'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000126',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000101',
    'email', 'duplicate@synthetic.invalid',
    'duplicate@synthetic.invalid', null
  )$$,
  'P0001',
  'solmind_guide_issue_existing_guide',
  'duplicate exact-contact identity candidates deny deterministically'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000127',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000101',
    'email', 'accepted-history@synthetic.invalid',
    'accepted-history@synthetic.invalid', null
  )$$,
  'P0001',
  'solmind_guide_issue_existing_guide',
  'accepted Guide-onboarding history denies even if identity is contradictory'
);
reset role;
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite
     where guide_invite_id between
       'a27c0030-3000-4000-8000-000000000121'::uuid
       and 'a27c0030-3000-4000-8000-000000000127'::uuid
  ),
  0,
  'all existing-Guide denials are invitation- and audit-writeless'
);

set local role service_role;
select is(
  (
    select outcome
      from public.solmind_issue_guide_invitation(
        'a27c0030-3000-4000-8000-000000000128',
        'a27c0030-0000-4000-8000-000000000101',
        'a27c0030-2000-4000-8000-000000000101',
        'email', 'explorer-only@synthetic.invalid',
        'explorer-only@synthetic.invalid', 'Explorer Adding Guide Role'
      )
  ),
  'issued',
  'healthy Explorer-only identity remains eligible for reviewed role addition'
);
reset role;

set local role service_role;
select is(
  (
    select outcome
      from public.solmind_revoke_guide_invitation(
        'a27c0030-3000-4000-8000-000000000128',
        'a27c0030-0000-4000-8000-000000000101',
        'a27c0030-2000-4000-8000-000000000101'
      )
  ),
  'revoked',
  'authorized Admin revokes one exact open Guide invitation'
);
reset role;
select ok(
  (
    select invite_status = 'revoked' and revoked_at is not null
      from core.guide_invite
     where guide_invite_id = 'a27c0030-3000-4000-8000-000000000128'
  ),
  'revocation preserves the row and sets its terminal state and timestamp'
);
select ok(
  (
    select row(
      event_type,
      actor_user_account_id,
      actor_role_context,
      target_entity_type,
      action,
      reason_code,
      event_summary,
      metadata
    ) is not distinct from row(
      'invite_revoked'::text,
      'a27c0030-0000-4000-8000-000000000101'::uuid,
      'admin'::text,
      'guide_invite'::text,
      'revoke'::text,
      'admin_revoked'::text,
      'Guide invitation revoked by Admin.'::text,
      '{}'::jsonb
    )
      from audit.audit_event
     where target_entity_id = 'a27c0030-3000-4000-8000-000000000128'
       and reason_code = 'admin_revoked'
  ),
  'Admin revocation audit is exact, attributed, and privacy-bounded'
);

set local role service_role;
select is(
  (
    select outcome
      from public.solmind_revoke_guide_invitation(
        'a27c0030-3000-4000-8000-000000000128',
        'a27c0030-0000-4000-8000-000000000101',
        'a27c0030-2000-4000-8000-000000000101'
      )
  ),
  'already_revoked',
  'exact revocation retry returns a writeless terminal observation'
);
reset role;
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0030-3000-4000-8000-000000000128'
       and event_type = 'invite_revoked'
       and reason_code = 'admin_revoked'
  ),
  1,
  'revocation retry writes no second audit row'
);

set local role service_role;
select is(
  (
    select outcome
      from public.solmind_revoke_guide_invitation(
        'a27c0030-3000-4000-8000-000000000120',
        'a27c0030-0000-4000-8000-000000000101',
        'a27c0030-2000-4000-8000-000000000101'
      )
  ),
  'accepted',
  'accepted target returns a writeless terminal observation'
);
reset role;

insert into core.guide_invite (
  guide_invite_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_by_user_account_id,
  invite_status,
  expires_at,
  sent_at
) values (
  'a27c0030-3000-4000-8000-000000000129',
  'revoke-expired@synthetic.invalid',
  'revoke-expired@synthetic.invalid',
  'email',
  'a27c0030-0000-4000-8000-000000000101',
  'sent',
  pg_catalog.now() - interval '1 minute',
  pg_catalog.now() - interval '2 hours'
);
set local role service_role;
select is(
  (
    select outcome
      from public.solmind_revoke_guide_invitation(
        'a27c0030-3000-4000-8000-000000000129',
        'a27c0030-0000-4000-8000-000000000101',
        'a27c0030-2000-4000-8000-000000000101'
      )
  ),
  'expired',
  'revocation materializes an already-expired open target'
);
reset role;
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0030-3000-4000-8000-000000000129'
  ),
  'expired',
  'expired target is not mislabeled as Admin-revoked'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0030-3000-4000-8000-000000000129'
       and event_type = 'invite_expired'
       and actor_role_context = 'system'
  ),
  1,
  'revocation-triggered expiry materialization has one system audit'
);

insert into core.guide_invite (
  guide_invite_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_by_user_account_id,
  invite_status,
  expires_at,
  failed_at
) values (
  'a27c0030-3000-4000-8000-000000000130',
  'failed-terminal@synthetic.invalid',
  'failed-terminal@synthetic.invalid',
  'email',
  'a27c0030-0000-4000-8000-000000000101',
  'failed',
  pg_catalog.now() + interval '1 hour',
  pg_catalog.now() - interval '1 minute'
);
set local role service_role;
select is(
  (
    select outcome
      from public.solmind_revoke_guide_invitation(
        'a27c0030-3000-4000-8000-000000000130',
        'a27c0030-0000-4000-8000-000000000101',
        'a27c0030-2000-4000-8000-000000000101'
      )
  ),
  'failed',
  'failed target returns a writeless terminal observation'
);
select throws_ok(
  $$select * from public.solmind_revoke_guide_invitation(
    'a27c0030-3000-4000-8000-000000000131',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000101'
  )$$,
  'P0001',
  'solmind_guide_revoke_not_found',
  'authorized missing target returns one fixed value-free error'
);
reset role;

insert into core.guide_invite (
  guide_invite_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_by_user_account_id,
  invite_status,
  expires_at
) values (
  'a27c0030-3000-4000-8000-000000000132',
  'unauthorized-revoke@synthetic.invalid',
  'unauthorized-revoke@synthetic.invalid',
  'email',
  'a27c0030-0000-4000-8000-000000000101',
  'created',
  pg_catalog.now() + interval '1 hour'
);
set local role service_role;
select throws_ok(
  $$select * from public.solmind_revoke_guide_invitation(
    'a27c0030-3000-4000-8000-000000000132',
    'a27c0030-0000-4000-8000-000000000102',
    'a27c0030-2000-4000-8000-000000000102'
  )$$,
  'P0001',
  'solmind_guide_revoke_unauthorized',
  'non-Admin cannot revoke an existing invitation'
);
reset role;
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0030-3000-4000-8000-000000000132'
  ),
  'created',
  'unauthorized revocation leaves the invitation unchanged'
);

savepoint missing_policy;
delete from core.invitation_lifetime_policy
 where invitation_role = 'guide';
set local role service_role;
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000110',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000101',
    'email', 'policy@synthetic.invalid', 'policy@synthetic.invalid', null
  )$$,
  'P0001',
  'solmind_guide_issue_policy_unavailable',
  'missing policy denies'
);
reset role;
rollback to savepoint missing_policy;
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite
     where guide_invite_id = 'a27c0030-3000-4000-8000-000000000110'
  ),
  0,
  'policy denial inserts no invitation'
);

create function pg_temp.reject_guide_issuance_audit()
returns trigger
language plpgsql
as $$
begin
  raise exception 'p27c_issuance_induced_audit_failure';
end;
$$;
create trigger reject_guide_issuance_audit
before insert on audit.audit_event
for each row execute function pg_temp.reject_guide_issuance_audit();

insert into core.guide_invite (
  guide_invite_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invited_by_user_account_id,
  invite_status,
  expires_at
) values (
  'a27c0030-3000-4000-8000-000000000133',
  'revoke-rollback@synthetic.invalid',
  'revoke-rollback@synthetic.invalid',
  'email',
  'a27c0030-0000-4000-8000-000000000101',
  'created',
  pg_catalog.now() + interval '1 hour'
);
set local role service_role;
select throws_ok(
  $$select * from public.solmind_revoke_guide_invitation(
    'a27c0030-3000-4000-8000-000000000133',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000101'
  )$$,
  'P0001',
  'solmind_guide_revoke_integrity_failure',
  'revocation audit failure maps to one fixed integrity error'
);
reset role;
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0030-3000-4000-8000-000000000133'
  ),
  'created',
  'revocation audit failure rolls back the state transition'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0030-3000-4000-8000-000000000133'
  ),
  0,
  'revocation audit failure leaves no partial audit row'
);

set local role service_role;
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-3000-4000-8000-000000000111',
    'a27c0030-0000-4000-8000-000000000101',
    'a27c0030-2000-4000-8000-000000000101',
    'email', 'rollback@synthetic.invalid', 'rollback@synthetic.invalid', null
  )$$,
  'P0001',
  'solmind_guide_issue_integrity_failure',
  'audit failure maps to the fixed integrity outcome'
);
reset role;
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite
     where guide_invite_id = 'a27c0030-3000-4000-8000-000000000111'
  ),
  0,
  'audit failure rolls back invitation insertion'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0030-3000-4000-8000-000000000111'
  ),
  0,
  'audit failure leaves no partial audit row'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.invitation_lifetime_policy
     where invitation_role = 'guide'
       and minimum_hours = 1
       and active_hours = 24
       and maximum_hours = 168
  ),
  1,
  'policy savepoint restored the exact Guide row'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite
     where contact_method_type = 'email'
       and normalized_contact_value = 'guide-one@synthetic.invalid'
       and invite_status in ('created', 'sent')
  ),
  1,
  'failure paths leave the valid replacement as the only open invitation'
);

select * from finish();
rollback;
