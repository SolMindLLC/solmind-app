begin;
select plan(22);

insert into identity.user_account (
  user_account_id,
  display_name,
  account_status
) values
  ('91000000-0000-4000-8000-000000000001', 'Predispatch Explorer', 'active'),
  ('91000000-0000-4000-8000-000000000002', 'Predispatch Guide', 'active'),
  ('91000000-0000-4000-8000-000000000003', 'Predispatch Admin', 'active');

insert into identity.user_role_assignment (
  user_role_assignment_id,
  user_account_id,
  role_code,
  role_status
) values
  (
    '91000000-0000-4000-8000-000000000011',
    '91000000-0000-4000-8000-000000000001',
    'explorer',
    'active'
  ),
  (
    '91000000-0000-4000-8000-000000000012',
    '91000000-0000-4000-8000-000000000002',
    'guide',
    'active'
  ),
  (
    '91000000-0000-4000-8000-000000000013',
    '91000000-0000-4000-8000-000000000003',
    'admin',
    'active'
  );

insert into core.organization (
  organization_id,
  organization_name,
  approval_status,
  approved_by_user_account_id,
  approved_at
) values (
  '91000000-0000-4000-8000-000000000021',
  'Predispatch Test Organization',
  'approved',
  '91000000-0000-4000-8000-000000000003',
  pg_catalog.now()
);

insert into core.practice (
  practice_id,
  organization_id,
  practice_name,
  approval_status,
  approved_by_user_account_id,
  approved_at
) values (
  '91000000-0000-4000-8000-000000000022',
  '91000000-0000-4000-8000-000000000021',
  'Predispatch Test Practice',
  'approved',
  '91000000-0000-4000-8000-000000000003',
  pg_catalog.now()
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
  '91000000-0000-4000-8000-000000000023',
  '91000000-0000-4000-8000-000000000002',
  'Predispatch Guide',
  'approved',
  '91000000-0000-4000-8000-000000000003',
  pg_catalog.now(),
  'active'
);

insert into core.explorer_profile (
  explorer_profile_id,
  user_account_id,
  explorer_display_name,
  onboarding_status,
  status
) values (
  '91000000-0000-4000-8000-000000000024',
  '91000000-0000-4000-8000-000000000001',
  'Predispatch Explorer',
  'active',
  'active'
);

insert into core.guide_explorer_relationship (
  guide_explorer_relationship_id,
  guide_profile_id,
  explorer_profile_id,
  practice_id,
  relationship_status,
  started_at
) values (
  '91000000-0000-4000-8000-000000000025',
  '91000000-0000-4000-8000-000000000023',
  '91000000-0000-4000-8000-000000000024',
  '91000000-0000-4000-8000-000000000022',
  'active',
  pg_catalog.now()
);

insert into core.consent_document (
  consent_document_id,
  consent_type,
  version_number,
  version_label,
  title,
  body_markdown,
  document_status,
  is_required_for_explorer,
  effective_at,
  created_by_user_account_id
) values
  (
    '91000000-0000-4000-8000-000000000031',
    'user_agreement',
    9101,
    'predispatch-9101',
    'Predispatch User Agreement',
    'Synthetic test agreement.',
    'active',
    true,
    pg_catalog.now(),
    '91000000-0000-4000-8000-000000000003'
  ),
  (
    '91000000-0000-4000-8000-000000000032',
    'ai_disclosure',
    9101,
    'predispatch-9101',
    'Predispatch AI Disclosure',
    'Synthetic test disclosure.',
    'active',
    true,
    pg_catalog.now(),
    '91000000-0000-4000-8000-000000000003'
  );

insert into core.consent_record (
  consent_record_id,
  user_account_id,
  role_context,
  consent_type,
  document_version,
  consent_document_id,
  adult_affirmation
) values
  (
    '91000000-0000-4000-8000-000000000041',
    '91000000-0000-4000-8000-000000000001',
    'explorer',
    'user_agreement',
    'predispatch-9101',
    '91000000-0000-4000-8000-000000000031',
    true
  ),
  (
    '91000000-0000-4000-8000-000000000042',
    '91000000-0000-4000-8000-000000000001',
    'explorer',
    'ai_disclosure',
    'predispatch-9101',
    '91000000-0000-4000-8000-000000000032',
    true
  );

insert into ai.ai_interaction_session (
  ai_interaction_session_id,
  session_type,
  session_status,
  actor_user_account_id,
  actor_role_context,
  explorer_profile_id,
  guide_explorer_relationship_id,
  practice_id,
  metadata
) values (
  '91000000-0000-4000-8000-000000000051',
  'explorer_reflection',
  'active',
  '91000000-0000-4000-8000-000000000001',
  'explorer',
  '91000000-0000-4000-8000-000000000024',
  '91000000-0000-4000-8000-000000000025',
  '91000000-0000-4000-8000-000000000022',
  '{"restricted_mode": false}'::jsonb
);

create temporary table virtual_guide_predispatch_fixture (
  logical_operation_id uuid not null,
  context_snapshot_id uuid not null,
  model_invocation_id uuid not null,
  session_id uuid not null,
  actor_account_id uuid not null,
  explorer_profile_id uuid not null,
  relationship_id uuid not null,
  required_consent_ids uuid[] not null,
  source_ids uuid[] not null,
  context_fingerprint text not null,
  authorization_version text null
) on commit drop;

insert into virtual_guide_predispatch_fixture values (
  '91000000-0000-4000-8000-000000000061',
  '91000000-0000-4000-8000-000000000062',
  '91000000-0000-4000-8000-000000000063',
  '91000000-0000-4000-8000-000000000051',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000024',
  '91000000-0000-4000-8000-000000000025',
  array[
    '91000000-0000-4000-8000-000000000031'::uuid,
    '91000000-0000-4000-8000-000000000032'::uuid
  ],
  array[
    '91000000-0000-4000-8000-000000000071'::uuid,
    '91000000-0000-4000-8000-000000000072'::uuid
  ],
  pg_catalog.repeat('A', 64),
  null
);

update virtual_guide_predispatch_fixture fixture
   set authorization_version =
     'AV1:' || pg_catalog.upper(
       pg_catalog.encode(
         extensions.digest(
           pg_catalog.convert_to(
             'contract=virtual-guide-predispatch-evidence.v1'
             || '|session=' || fixture.session_id::text
             || '|account=' || fixture.actor_account_id::text
             || '|explorer=' || fixture.explorer_profile_id::text
             || '|relationship=' || fixture.relationship_id::text
             || '|session_type=explorer_reflection'
             || '|session_status=active'
             || '|practice=91000000-0000-4000-8000-000000000022'
             || '|practice_status=active'
             || '|practice_approval_status=approved'
             || '|restricted_mode=clear'
             || '|profile_status=active'
             || '|onboarding_status=active'
             || '|relationship_status=active'
             || '|required_consents='
             || pg_catalog.array_to_string(
               fixture.required_consent_ids,
               ','
             ),
             'UTF8'
           ),
           'sha256'
         ),
         'hex'
       )
     );

select results_eq(
  $$
    select preparation_state,
           prepared_context_snapshot_id,
           prepared_model_invocation_id
      from virtual_guide_predispatch_fixture fixture
      cross join lateral public.solmind_prepare_virtual_guide_predispatch(
        fixture.logical_operation_id,
        fixture.context_snapshot_id,
        fixture.model_invocation_id,
        fixture.session_id,
        fixture.actor_account_id,
        fixture.explorer_profile_id,
        fixture.relationship_id,
        fixture.authorization_version,
        fixture.required_consent_ids,
        fixture.source_ids,
        fixture.context_fingerprint
      ) prepared
  $$,
  $$
    values (
      'created'::text,
      '91000000-0000-4000-8000-000000000062'::uuid,
      '91000000-0000-4000-8000-000000000063'::uuid
    )
  $$,
  'first preparation atomically creates one snapshot and one started invocation'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_context_snapshot snapshot
      join virtual_guide_predispatch_fixture fixture
        on fixture.context_snapshot_id = snapshot.ai_context_snapshot_id
     where snapshot.ai_interaction_session_id = fixture.session_id
       and snapshot.actor_user_account_id = fixture.actor_account_id
       and snapshot.explorer_profile_id = fixture.explorer_profile_id
       and snapshot.guide_explorer_relationship_id = fixture.relationship_id
       and snapshot.authorization_version = fixture.authorization_version
       and snapshot.active_required_consent_document_ids =
         fixture.required_consent_ids
       and snapshot.context_source_ids = fixture.source_ids
       and snapshot.context_fingerprint_sha256 = fixture.context_fingerprint
       and snapshot.prompt_version = 'virtual-guide-conversation.v1'
       and snapshot.evidence_contract_version =
         'virtual-guide-predispatch-evidence.v1'
       and snapshot.context_summary is null
       and snapshot.metadata = '{}'::jsonb
  ),
  1,
  'snapshot stores exact bounded evidence and no content summary'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_model_invocation invocation
      join virtual_guide_predispatch_fixture fixture
        on fixture.model_invocation_id = invocation.ai_model_invocation_id
     where invocation.logical_operation_id = fixture.logical_operation_id
       and invocation.ai_context_snapshot_id = fixture.context_snapshot_id
       and invocation.ai_interaction_session_id = fixture.session_id
       and invocation.provider_name = 'openai'
       and invocation.model_name = 'gpt-5.6-luna'
       and invocation.prompt_version = 'virtual-guide-conversation.v1'
       and invocation.request_status = 'started'
       and invocation.completed_at is null
       and invocation.dispatch_contract_version =
         'virtual-guide-predispatch-evidence.v1'
  ),
  1,
  'started invocation is bound to the exact snapshot and fixed dormant adapter'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.target_entity_id in (
       '91000000-0000-4000-8000-000000000062'::uuid,
       '91000000-0000-4000-8000-000000000063'::uuid
     )
       and event.event_type in (
         'ai_context_snapshot_created',
         'ai_model_invocation_started'
       )
  ),
  2,
  'the same transaction writes exactly two closed Family E rows'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.target_entity_id in (
       '91000000-0000-4000-8000-000000000062'::uuid,
       '91000000-0000-4000-8000-000000000063'::uuid
     )
       and (
         event.metadata ? 'context_fingerprint'
         or event.metadata ? 'authorization_version'
         or event.metadata ? 'context_source_ids'
         or event.metadata::text like '%AAAAAAAAAAAAAAAA%'
       )
  ),
  0,
  'Family E audit rows contain no fingerprint, authorization proof, source set, or content bytes'
);

select results_eq(
  $$
    select preparation_state,
           prepared_context_snapshot_id,
           prepared_model_invocation_id
      from virtual_guide_predispatch_fixture fixture
      cross join lateral public.solmind_prepare_virtual_guide_predispatch(
        fixture.logical_operation_id,
        fixture.context_snapshot_id,
        fixture.model_invocation_id,
        fixture.session_id,
        fixture.actor_account_id,
        fixture.explorer_profile_id,
        fixture.relationship_id,
        fixture.authorization_version,
        fixture.required_consent_ids,
        fixture.source_ids,
        fixture.context_fingerprint
      ) prepared
  $$,
  $$
    values (
      'exact_retry'::text,
      '91000000-0000-4000-8000-000000000062'::uuid,
      '91000000-0000-4000-8000-000000000063'::uuid
    )
  $$,
  'exact retry returns retained evidence with a no-dispatch disposition'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_context_snapshot
     where ai_context_snapshot_id =
       '91000000-0000-4000-8000-000000000062'
  ),
  1,
  'exact retry creates no second snapshot'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_model_invocation
     where logical_operation_id =
       '91000000-0000-4000-8000-000000000061'
  ),
  1,
  'exact retry creates no second invocation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id in (
       '91000000-0000-4000-8000-000000000062'::uuid,
       '91000000-0000-4000-8000-000000000063'::uuid
     )
  ),
  2,
  'exact retry creates no duplicate audit rows'
);

select throws_ok(
  $$
    select *
      from virtual_guide_predispatch_fixture fixture
      cross join lateral public.solmind_prepare_virtual_guide_predispatch(
        fixture.logical_operation_id,
        fixture.context_snapshot_id,
        fixture.model_invocation_id,
        fixture.session_id,
        fixture.actor_account_id,
        fixture.explorer_profile_id,
        fixture.relationship_id,
        fixture.authorization_version,
        fixture.required_consent_ids,
        fixture.source_ids,
        pg_catalog.repeat('B', 64)
      ) prepared
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_operation_conflict',
  'changed payload under one operation identity fails closed'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_model_invocation
     where logical_operation_id =
       '91000000-0000-4000-8000-000000000061'
  ),
  1,
  'changed-payload conflict is writeless'
);

select throws_ok(
  $$
    select *
      from virtual_guide_predispatch_fixture fixture
      cross join lateral public.solmind_prepare_virtual_guide_predispatch(
        '91000000-0000-4000-8000-000000000081'::uuid,
        '91000000-0000-4000-8000-000000000082'::uuid,
        '91000000-0000-4000-8000-000000000083'::uuid,
        fixture.session_id,
        fixture.actor_account_id,
        fixture.explorer_profile_id,
        fixture.relationship_id,
        'AV1:' || pg_catalog.repeat('0', 64),
        fixture.required_consent_ids,
        fixture.source_ids,
        fixture.context_fingerprint
      ) prepared
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_stale_authorization',
  'stale authorization proof fails before any evidence write'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_model_invocation
     where logical_operation_id =
       '91000000-0000-4000-8000-000000000081'
  ),
  0,
  'stale authorization leaves no invocation residue'
);

update ai.ai_interaction_session
   set metadata = '{"restricted_mode": true}'::jsonb
 where ai_interaction_session_id =
   '91000000-0000-4000-8000-000000000051';

select throws_ok(
  $$
    select *
      from virtual_guide_predispatch_fixture fixture
      cross join lateral public.solmind_prepare_virtual_guide_predispatch(
        '91000000-0000-4000-8000-000000000091'::uuid,
        '91000000-0000-4000-8000-000000000092'::uuid,
        '91000000-0000-4000-8000-000000000093'::uuid,
        fixture.session_id,
        fixture.actor_account_id,
        fixture.explorer_profile_id,
        fixture.relationship_id,
        fixture.authorization_version,
        fixture.required_consent_ids,
        fixture.source_ids,
        fixture.context_fingerprint
      ) prepared
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'restricted mode fails closed before any provider-dispatch evidence'
);

update ai.ai_interaction_session
   set metadata = '{"restricted_mode": false}'::jsonb
 where ai_interaction_session_id =
   '91000000-0000-4000-8000-000000000051';

update core.guide_explorer_relationship
   set relationship_status = 'ended',
       ended_at = pg_catalog.now()
 where guide_explorer_relationship_id =
   '91000000-0000-4000-8000-000000000025';

select throws_ok(
  $$
    select *
      from virtual_guide_predispatch_fixture fixture
      cross join lateral public.solmind_prepare_virtual_guide_predispatch(
        '91000000-0000-4000-8000-0000000000a1'::uuid,
        '91000000-0000-4000-8000-0000000000a2'::uuid,
        '91000000-0000-4000-8000-0000000000a3'::uuid,
        fixture.session_id,
        fixture.actor_account_id,
        fixture.explorer_profile_id,
        fixture.relationship_id,
        fixture.authorization_version,
        fixture.required_consent_ids,
        fixture.source_ids,
        fixture.context_fingerprint
      ) prepared
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'ended relationship fails closed before any evidence write'
);

update core.guide_explorer_relationship
   set relationship_status = 'active',
       ended_at = null
 where guide_explorer_relationship_id =
   '91000000-0000-4000-8000-000000000025';

update core.consent_record
   set adult_affirmation = false
 where consent_record_id =
   '91000000-0000-4000-8000-000000000041';

select throws_ok(
  $$
    select *
      from virtual_guide_predispatch_fixture fixture
      cross join lateral public.solmind_prepare_virtual_guide_predispatch(
        '91000000-0000-4000-8000-0000000000b1'::uuid,
        '91000000-0000-4000-8000-0000000000b2'::uuid,
        '91000000-0000-4000-8000-0000000000b3'::uuid,
        fixture.session_id,
        fixture.actor_account_id,
        fixture.explorer_profile_id,
        fixture.relationship_id,
        fixture.authorization_version,
        fixture.required_consent_ids,
        fixture.source_ids,
        fixture.context_fingerprint
      ) prepared
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_consent_denied',
  'missing adult affirmation fails closed before any evidence write'
);

update core.consent_record
   set adult_affirmation = true
 where consent_record_id =
   '91000000-0000-4000-8000-000000000041';

select throws_ok(
  $$
    select *
      from virtual_guide_predispatch_fixture fixture
      cross join lateral public.solmind_prepare_virtual_guide_predispatch(
        '91000000-0000-4000-8000-0000000000c1'::uuid,
        '91000000-0000-4000-8000-0000000000c2'::uuid,
        '91000000-0000-4000-8000-0000000000c3'::uuid,
        fixture.session_id,
        fixture.actor_account_id,
        fixture.explorer_profile_id,
        fixture.relationship_id,
        fixture.authorization_version,
        fixture.required_consent_ids,
        array[
          fixture.source_ids[2],
          fixture.source_ids[1]
        ],
        fixture.context_fingerprint
      ) prepared
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_noncanonical_input',
  'noncanonical source identities fail before locking or writes'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_model_invocation
     where logical_operation_id in (
       '91000000-0000-4000-8000-000000000081'::uuid,
       '91000000-0000-4000-8000-000000000091'::uuid,
       '91000000-0000-4000-8000-0000000000a1'::uuid,
       '91000000-0000-4000-8000-0000000000b1'::uuid,
       '91000000-0000-4000-8000-0000000000c1'::uuid
     )
  ),
  0,
  'all denied paths remain writeless'
);

update ai.ai_interaction_session
   set session_type = 'guide_prep'
 where ai_interaction_session_id =
   '91000000-0000-4000-8000-000000000051';

select throws_ok(
  $$
    select *
      from virtual_guide_predispatch_fixture fixture
      cross join lateral public.solmind_prepare_virtual_guide_predispatch(
        '91000000-0000-4000-8000-0000000000d1'::uuid,
        '91000000-0000-4000-8000-0000000000d2'::uuid,
        '91000000-0000-4000-8000-0000000000d3'::uuid,
        fixture.session_id,
        fixture.actor_account_id,
        fixture.explorer_profile_id,
        fixture.relationship_id,
        fixture.authorization_version,
        fixture.required_consent_ids,
        fixture.source_ids,
        fixture.context_fingerprint
      ) prepared
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'non-Explorer session types fail closed before any evidence write'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_model_invocation
     where logical_operation_id =
       '91000000-0000-4000-8000-0000000000d1'
  ),
  0,
  'non-Explorer session-type denial leaves no invocation residue'
);

update ai.ai_interaction_session
   set session_type = 'explorer_reflection',
       practice_id = null
 where ai_interaction_session_id =
   '91000000-0000-4000-8000-000000000051';

select throws_ok(
  $$
    select *
      from virtual_guide_predispatch_fixture fixture
      cross join lateral public.solmind_prepare_virtual_guide_predispatch(
        '91000000-0000-4000-8000-0000000000e1'::uuid,
        '91000000-0000-4000-8000-0000000000e2'::uuid,
        '91000000-0000-4000-8000-0000000000e3'::uuid,
        fixture.session_id,
        fixture.actor_account_id,
        fixture.explorer_profile_id,
        fixture.relationship_id,
        fixture.authorization_version,
        fixture.required_consent_ids,
        fixture.source_ids,
        fixture.context_fingerprint
      ) prepared
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'missing or mismatched session Practice fails closed'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_model_invocation
     where logical_operation_id =
       '91000000-0000-4000-8000-0000000000e1'
  ),
  0,
  'Practice-binding denial leaves no invocation residue'
);

select * from finish();
rollback;
