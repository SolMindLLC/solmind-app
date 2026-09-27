begin;
select plan(32);

-- Case identifiers follow 93000000-0000-4000-8000-0000000CC00K, where CC is
-- the two-digit case number and K is 1 (logical operation), 2 (context
-- snapshot) or 3 (model invocation).

insert into identity.user_account (
  user_account_id,
  display_name,
  account_status
) values
  ('93000000-0000-4000-8000-000000000001', 'Hardening Explorer', 'active'),
  ('93000000-0000-4000-8000-000000000002', 'Hardening Guide', 'active'),
  ('93000000-0000-4000-8000-000000000003', 'Hardening Admin', 'active'),
  ('93000000-0000-4000-8000-000000000004', 'Hardening Second Guide', 'active');

insert into identity.user_role_assignment (
  user_role_assignment_id,
  user_account_id,
  role_code,
  role_status
) values
  (
    '93000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000001',
    'explorer',
    'active'
  ),
  (
    '93000000-0000-4000-8000-000000000012',
    '93000000-0000-4000-8000-000000000002',
    'guide',
    'active'
  ),
  (
    '93000000-0000-4000-8000-000000000013',
    '93000000-0000-4000-8000-000000000003',
    'admin',
    'active'
  ),
  (
    '93000000-0000-4000-8000-000000000014',
    '93000000-0000-4000-8000-000000000004',
    'guide',
    'active'
  );

insert into core.organization (
  organization_id,
  organization_name,
  approval_status,
  approved_by_user_account_id,
  approved_at
) values (
  '93000000-0000-4000-8000-000000000021',
  'Hardening Test Organization',
  'approved',
  '93000000-0000-4000-8000-000000000003',
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
  '93000000-0000-4000-8000-000000000022',
  '93000000-0000-4000-8000-000000000021',
  'Hardening Test Practice',
  'approved',
  '93000000-0000-4000-8000-000000000003',
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
) values
  (
    '93000000-0000-4000-8000-000000000023',
    '93000000-0000-4000-8000-000000000002',
    'Hardening Guide',
    'approved',
    '93000000-0000-4000-8000-000000000003',
    pg_catalog.now(),
    'active'
  ),
  (
    '93000000-0000-4000-8000-000000000026',
    '93000000-0000-4000-8000-000000000004',
    'Hardening Second Guide',
    'approved',
    '93000000-0000-4000-8000-000000000003',
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
  '93000000-0000-4000-8000-000000000024',
  '93000000-0000-4000-8000-000000000001',
  'Hardening Explorer',
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
  '93000000-0000-4000-8000-000000000025',
  '93000000-0000-4000-8000-000000000023',
  '93000000-0000-4000-8000-000000000024',
  '93000000-0000-4000-8000-000000000022',
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
    '93000000-0000-4000-8000-000000000031',
    'user_agreement',
    9301,
    'predispatch-9301',
    'Hardening User Agreement',
    'Synthetic test agreement.',
    'active',
    true,
    pg_catalog.now(),
    '93000000-0000-4000-8000-000000000003'
  ),
  (
    '93000000-0000-4000-8000-000000000032',
    'ai_disclosure',
    9301,
    'predispatch-9301',
    'Hardening AI Disclosure',
    'Synthetic test disclosure.',
    'active',
    true,
    pg_catalog.now(),
    '93000000-0000-4000-8000-000000000003'
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
    '93000000-0000-4000-8000-000000000041',
    '93000000-0000-4000-8000-000000000001',
    'explorer',
    'user_agreement',
    'predispatch-9301',
    '93000000-0000-4000-8000-000000000031',
    true
  ),
  (
    '93000000-0000-4000-8000-000000000042',
    '93000000-0000-4000-8000-000000000001',
    'explorer',
    'ai_disclosure',
    'predispatch-9301',
    '93000000-0000-4000-8000-000000000032',
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
  '93000000-0000-4000-8000-000000000051',
  'explorer_reflection',
  'active',
  '93000000-0000-4000-8000-000000000001',
  'explorer',
  '93000000-0000-4000-8000-000000000024',
  '93000000-0000-4000-8000-000000000025',
  '93000000-0000-4000-8000-000000000022',
  '{"restricted_mode": false}'::jsonb
);

create temporary table s03d_hardening_fixture (
  session_id uuid not null,
  actor_account_id uuid not null,
  explorer_profile_id uuid not null,
  relationship_id uuid not null,
  required_consent_ids uuid[] not null,
  source_ids uuid[] not null,
  context_fingerprint text not null,
  authorization_version text null
) on commit drop;

insert into s03d_hardening_fixture values (
  '93000000-0000-4000-8000-000000000051',
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000024',
  '93000000-0000-4000-8000-000000000025',
  array[
    '93000000-0000-4000-8000-000000000031'::uuid,
    '93000000-0000-4000-8000-000000000032'::uuid
  ],
  array[
    '93000000-0000-4000-8000-000000000071'::uuid,
    '93000000-0000-4000-8000-000000000072'::uuid
  ],
  pg_catalog.repeat('C', 64),
  null
);

update s03d_hardening_fixture fixture
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
             || '|practice=93000000-0000-4000-8000-000000000022'
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

create function pg_temp.s03d_hardening_case_id(
  p_case integer,
  p_kind integer
)
returns uuid
language sql
immutable
as $$
  select (
    '93000000-0000-4000-8000-0000000'
    || pg_catalog.lpad(p_case::text, 2, '0')
    || '00'
    || p_kind::text
  )::uuid
$$;

create function pg_temp.s03d_hardening_prepare(
  p_logical_operation_id uuid,
  p_ai_context_snapshot_id uuid,
  p_ai_model_invocation_id uuid,
  p_actor_account_id uuid default null,
  p_required_consent_ids uuid[] default null
)
returns table (
  preparation_state text,
  prepared_context_snapshot_id uuid,
  prepared_model_invocation_id uuid
)
language sql
as $$
  select prepared.*
    from s03d_hardening_fixture fixture
    cross join lateral public.solmind_prepare_virtual_guide_predispatch(
      p_logical_operation_id,
      p_ai_context_snapshot_id,
      p_ai_model_invocation_id,
      fixture.session_id,
      coalesce(p_actor_account_id, fixture.actor_account_id),
      fixture.explorer_profile_id,
      fixture.relationship_id,
      fixture.authorization_version,
      coalesce(p_required_consent_ids, fixture.required_consent_ids),
      fixture.source_ids,
      fixture.context_fingerprint
    ) prepared
$$;

-- Case 02 legacy context snapshot: every pre-dispatch evidence column is NULL.
insert into ai.ai_context_snapshot (
  ai_context_snapshot_id,
  ai_interaction_session_id,
  prompt_version
) values (
  pg_temp.s03d_hardening_case_id(2, 2),
  '93000000-0000-4000-8000-000000000051',
  'virtual-guide-conversation.v1'
);

-- Case 01: the populated invocation branch rejects a NULL contract version.
select throws_ok(
  $$
    insert into ai.ai_model_invocation (
      ai_model_invocation_id,
      ai_interaction_session_id,
      provider_name,
      model_name,
      prompt_version,
      request_status,
      logical_operation_id,
      ai_context_snapshot_id,
      dispatch_contract_version
    ) values (
      pg_temp.s03d_hardening_case_id(1, 3),
      '93000000-0000-4000-8000-000000000051',
      'openai',
      'gpt-5.6-luna',
      'virtual-guide-conversation.v1',
      'started',
      pg_temp.s03d_hardening_case_id(1, 1),
      pg_temp.s03d_hardening_case_id(2, 2),
      null
    )
  $$,
  '23514',
  'new row for relation "ai_model_invocation" violates check constraint "ai_model_invocation_predispatch_evidence_shape_check"',
  'invocation evidence shape rejects a populated row with a NULL contract version'
);

-- Case 02: a v1 invocation bound to the legacy snapshot, with matching audit
-- rows, must be an operation conflict, not an exact retry.
insert into ai.ai_model_invocation (
  ai_model_invocation_id,
  ai_interaction_session_id,
  provider_name,
  model_name,
  prompt_version,
  request_status,
  logical_operation_id,
  ai_context_snapshot_id,
  dispatch_contract_version
) values (
  pg_temp.s03d_hardening_case_id(2, 3),
  '93000000-0000-4000-8000-000000000051',
  'openai',
  'gpt-5.6-luna',
  'virtual-guide-conversation.v1',
  'started',
  pg_temp.s03d_hardening_case_id(2, 1),
  pg_temp.s03d_hardening_case_id(2, 2),
  'virtual-guide-predispatch-evidence.v1'
);

insert into audit.audit_event (
  event_type,
  actor_user_account_id,
  actor_role_context,
  target_entity_type,
  target_entity_id,
  action,
  reason_code,
  event_summary,
  metadata
) values
  (
    'ai_context_snapshot_created',
    '93000000-0000-4000-8000-000000000001',
    'explorer',
    'ai_context_snapshot',
    pg_temp.s03d_hardening_case_id(2, 2),
    'create',
    'pre_dispatch_snapshot_created',
    'Virtual Guide context snapshot created before provider dispatch.',
    pg_catalog.jsonb_build_object(
      'contract_version', 'virtual-guide-predispatch-evidence.v1',
      'operation_id', pg_temp.s03d_hardening_case_id(2, 1)::text,
      'role_context', 'explorer',
      'session_id', '93000000-0000-4000-8000-000000000051'
    )
  ),
  (
    'ai_model_invocation_started',
    '93000000-0000-4000-8000-000000000001',
    'explorer',
    'ai_model_invocation',
    pg_temp.s03d_hardening_case_id(2, 3),
    'start',
    'pre_dispatch_invocation_started',
    'Virtual Guide model invocation started before provider dispatch.',
    pg_catalog.jsonb_build_object(
      'context_snapshot_id', pg_temp.s03d_hardening_case_id(2, 2)::text,
      'contract_version', 'virtual-guide-predispatch-evidence.v1',
      'model_name', 'gpt-5.6-luna',
      'operation_id', pg_temp.s03d_hardening_case_id(2, 1)::text,
      'provider_name', 'openai',
      'request_status', 'started',
      'role_context', 'explorer',
      'session_id', '93000000-0000-4000-8000-000000000051'
    )
  );

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(2, 1),
        pg_temp.s03d_hardening_case_id(2, 2),
        pg_temp.s03d_hardening_case_id(2, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_operation_conflict',
  'an operation bound to a legacy all-NULL snapshot fails closed as a conflict'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_model_invocation
     where logical_operation_id = pg_temp.s03d_hardening_case_id(2, 1)
  ),
  1,
  'legacy-snapshot conflict writes no second invocation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id in (
       pg_temp.s03d_hardening_case_id(2, 2),
       pg_temp.s03d_hardening_case_id(2, 3)
     )
  ),
  2,
  'legacy-snapshot conflict writes no audit row'
);

-- Case 03: complete v1 evidence without its two audit rows is incomplete.
insert into ai.ai_context_snapshot (
  ai_context_snapshot_id,
  ai_interaction_session_id,
  prompt_version,
  actor_user_account_id,
  explorer_profile_id,
  guide_explorer_relationship_id,
  authorization_version,
  active_required_consent_document_ids,
  context_source_ids,
  context_fingerprint_sha256,
  evidence_contract_version
)
select
  pg_temp.s03d_hardening_case_id(3, 2),
  fixture.session_id,
  'virtual-guide-conversation.v1',
  fixture.actor_account_id,
  fixture.explorer_profile_id,
  fixture.relationship_id,
  fixture.authorization_version,
  fixture.required_consent_ids,
  fixture.source_ids,
  fixture.context_fingerprint,
  'virtual-guide-predispatch-evidence.v1'
  from s03d_hardening_fixture fixture;

insert into ai.ai_model_invocation (
  ai_model_invocation_id,
  ai_interaction_session_id,
  provider_name,
  model_name,
  prompt_version,
  request_status,
  logical_operation_id,
  ai_context_snapshot_id,
  dispatch_contract_version
) values (
  pg_temp.s03d_hardening_case_id(3, 3),
  '93000000-0000-4000-8000-000000000051',
  'openai',
  'gpt-5.6-luna',
  'virtual-guide-conversation.v1',
  'started',
  pg_temp.s03d_hardening_case_id(3, 1),
  pg_temp.s03d_hardening_case_id(3, 2),
  'virtual-guide-predispatch-evidence.v1'
);

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(3, 1),
        pg_temp.s03d_hardening_case_id(3, 2),
        pg_temp.s03d_hardening_case_id(3, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_evidence_incomplete',
  'retained evidence without its exact audit rows fails closed as incomplete'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id in (
       pg_temp.s03d_hardening_case_id(3, 2),
       pg_temp.s03d_hardening_case_id(3, 3)
     )
  ),
  0,
  'incomplete-evidence denial writes no audit row'
);

-- Cases 04-15: behavioral authority, eligibility and input negatives.
select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(4, 1),
        pg_temp.s03d_hardening_case_id(4, 2),
        pg_temp.s03d_hardening_case_id(4, 3),
        '93000000-0000-4000-8000-000000000002'
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'an actor other than the session Explorer fails closed'
);

update identity.user_account
   set account_status = 'suspended'
 where user_account_id = '93000000-0000-4000-8000-000000000001';

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(5, 1),
        pg_temp.s03d_hardening_case_id(5, 2),
        pg_temp.s03d_hardening_case_id(5, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'a suspended Explorer account fails closed'
);

update identity.user_account
   set account_status = 'active'
 where user_account_id = '93000000-0000-4000-8000-000000000001';

update identity.user_role_assignment
   set role_status = 'revoked'
 where user_role_assignment_id = '93000000-0000-4000-8000-000000000011';

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(6, 1),
        pg_temp.s03d_hardening_case_id(6, 2),
        pg_temp.s03d_hardening_case_id(6, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'a revoked Explorer role fails closed'
);

update identity.user_role_assignment
   set role_status = 'active'
 where user_role_assignment_id = '93000000-0000-4000-8000-000000000011';

update core.explorer_profile
   set onboarding_status = 'paused'
 where explorer_profile_id = '93000000-0000-4000-8000-000000000024';

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(7, 1),
        pg_temp.s03d_hardening_case_id(7, 2),
        pg_temp.s03d_hardening_case_id(7, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'a paused Explorer onboarding state fails closed'
);

update core.explorer_profile
   set onboarding_status = 'active'
 where explorer_profile_id = '93000000-0000-4000-8000-000000000024';

update ai.ai_interaction_session
   set session_status = 'paused',
       paused_at = pg_catalog.now()
 where ai_interaction_session_id = '93000000-0000-4000-8000-000000000051';

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(8, 1),
        pg_temp.s03d_hardening_case_id(8, 2),
        pg_temp.s03d_hardening_case_id(8, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'a paused session fails closed'
);

update ai.ai_interaction_session
   set session_status = 'active',
       paused_at = null
 where ai_interaction_session_id = '93000000-0000-4000-8000-000000000051';

update core.practice
   set status = 'inactive'
 where practice_id = '93000000-0000-4000-8000-000000000022';

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(9, 1),
        pg_temp.s03d_hardening_case_id(9, 2),
        pg_temp.s03d_hardening_case_id(9, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'an inactive Practice fails closed'
);

update core.practice
   set status = 'active',
       approval_status = 'submitted'
 where practice_id = '93000000-0000-4000-8000-000000000022';

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(10, 1),
        pg_temp.s03d_hardening_case_id(10, 2),
        pg_temp.s03d_hardening_case_id(10, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'an unapproved Practice fails closed'
);

update core.practice
   set approval_status = 'approved'
 where practice_id = '93000000-0000-4000-8000-000000000022';

update core.organization
   set status = 'inactive'
 where organization_id = '93000000-0000-4000-8000-000000000021';

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(11, 1),
        pg_temp.s03d_hardening_case_id(11, 2),
        pg_temp.s03d_hardening_case_id(11, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'an inactive Organization behind the Practice fails closed'
);

update core.organization
   set status = 'active',
       approval_status = 'changes_requested'
 where organization_id = '93000000-0000-4000-8000-000000000021';

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(12, 1),
        pg_temp.s03d_hardening_case_id(12, 2),
        pg_temp.s03d_hardening_case_id(12, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'an unapproved Organization behind the Practice fails closed'
);

update core.organization
   set approval_status = 'approved'
 where organization_id = '93000000-0000-4000-8000-000000000021';

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(13, 1),
        pg_temp.s03d_hardening_case_id(13, 2),
        pg_temp.s03d_hardening_case_id(13, 3),
        null,
        array['93000000-0000-4000-8000-000000000031'::uuid]
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_consent_denied',
  'an incomplete required-consent set fails closed'
);

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        null,
        pg_temp.s03d_hardening_case_id(14, 2),
        pg_temp.s03d_hardening_case_id(14, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_invalid_input',
  'a missing logical operation identity fails before any lock or write'
);

insert into core.guide_explorer_relationship (
  guide_explorer_relationship_id,
  guide_profile_id,
  explorer_profile_id,
  practice_id,
  relationship_status
) values (
  '93000000-0000-4000-8000-000000000027',
  '93000000-0000-4000-8000-000000000026',
  '93000000-0000-4000-8000-000000000024',
  '93000000-0000-4000-8000-000000000022',
  'invited'
);

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(15, 1),
        pg_temp.s03d_hardening_case_id(15, 2),
        pg_temp.s03d_hardening_case_id(15, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_authority_denied',
  'a second current Guide relationship for the Explorer fails closed'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_context_snapshot
     where ai_context_snapshot_id in (
       select pg_temp.s03d_hardening_case_id(case_number, 2)
         from pg_catalog.generate_series(4, 15) as cases(case_number)
     )
  ),
  0,
  'cases 04-15 write no context snapshot'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_model_invocation
     where logical_operation_id in (
       select pg_temp.s03d_hardening_case_id(case_number, 1)
         from pg_catalog.generate_series(4, 15) as cases(case_number)
     )
        or ai_model_invocation_id in (
       select pg_temp.s03d_hardening_case_id(case_number, 3)
         from pg_catalog.generate_series(4, 15) as cases(case_number)
     )
  ),
  0,
  'cases 04-15 write no model invocation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id in (
       select pg_temp.s03d_hardening_case_id(case_number, kind)
         from pg_catalog.generate_series(4, 15) as cases(case_number)
         cross join (values (2), (3)) as kinds(kind)
     )
  ),
  0,
  'cases 04-15 write no audit row'
);

-- Case 16: a terminal second relationship does not block preparation.
update core.guide_explorer_relationship
   set relationship_status = 'ended',
       ended_at = pg_catalog.now()
 where guide_explorer_relationship_id =
   '93000000-0000-4000-8000-000000000027';

select results_eq(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(16, 1),
        pg_temp.s03d_hardening_case_id(16, 2),
        pg_temp.s03d_hardening_case_id(16, 3)
      )
  $$,
  $$
    values (
      'created'::text,
      '93000000-0000-4000-8000-000000016002'::uuid,
      '93000000-0000-4000-8000-000000016003'::uuid
    )
  $$,
  'an ended second relationship leaves the single-Guide topology intact'
);
select results_eq(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(16, 1),
        pg_temp.s03d_hardening_case_id(16, 2),
        pg_temp.s03d_hardening_case_id(16, 3)
      )
  $$,
  $$
    values (
      'exact_retry'::text,
      '93000000-0000-4000-8000-000000016002'::uuid,
      '93000000-0000-4000-8000-000000016003'::uuid
    )
  $$,
  'the hardened comparisons still return exact_retry for identical evidence'
);

-- Cases 17-18: identifier reuse under a new logical operation.
select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(17, 1),
        pg_temp.s03d_hardening_case_id(16, 2),
        pg_temp.s03d_hardening_case_id(17, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_operation_conflict',
  'reusing a context snapshot identifier under a new operation is a conflict'
);
select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(18, 1),
        pg_temp.s03d_hardening_case_id(18, 2),
        pg_temp.s03d_hardening_case_id(16, 3)
      )
  $$,
  'P0001',
  'solmind_virtual_guide_predispatch_operation_conflict',
  'reusing a model invocation identifier under a new operation is a conflict'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_context_snapshot
     where ai_context_snapshot_id = pg_temp.s03d_hardening_case_id(18, 2)
  ),
  0,
  'invocation-identifier reuse leaves no new context snapshot'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_model_invocation
     where logical_operation_id in (
       pg_temp.s03d_hardening_case_id(17, 1),
       pg_temp.s03d_hardening_case_id(18, 1)
     )
        or ai_model_invocation_id = pg_temp.s03d_hardening_case_id(17, 3)
  ),
  0,
  'identifier reuse writes no model invocation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id in (
       pg_temp.s03d_hardening_case_id(16, 2),
       pg_temp.s03d_hardening_case_id(16, 3),
       pg_temp.s03d_hardening_case_id(17, 3),
       pg_temp.s03d_hardening_case_id(18, 2)
     )
  ),
  2,
  'identifier reuse adds no audit row beyond the two case 16 rows'
);

-- Case 19: an audit-write failure rolls back the snapshot and invocation.
create function pg_temp.s03d_hardening_reject_invocation_audit()
returns trigger
language plpgsql
as $$
begin
  if new.event_type = 'ai_model_invocation_started' then
    raise exception 's03d_hardening_injected_audit_failure';
  end if;
  return new;
end;
$$;

create trigger s03d_hardening_reject_invocation_audit
before insert on audit.audit_event
for each row execute function pg_temp.s03d_hardening_reject_invocation_audit();

select throws_ok(
  $$
    select *
      from pg_temp.s03d_hardening_prepare(
        pg_temp.s03d_hardening_case_id(19, 1),
        pg_temp.s03d_hardening_case_id(19, 2),
        pg_temp.s03d_hardening_case_id(19, 3)
      )
  $$,
  'P0001',
  's03d_hardening_injected_audit_failure',
  'an injected second audit-write failure aborts the whole preparation'
);

drop trigger s03d_hardening_reject_invocation_audit on audit.audit_event;

select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_context_snapshot
     where ai_context_snapshot_id = pg_temp.s03d_hardening_case_id(19, 2)
  ),
  0,
  'audit failure leaves no context snapshot'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_model_invocation
     where logical_operation_id = pg_temp.s03d_hardening_case_id(19, 1)
  ),
  0,
  'audit failure leaves no model invocation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id in (
       pg_temp.s03d_hardening_case_id(19, 2),
       pg_temp.s03d_hardening_case_id(19, 3)
     )
  ),
  0,
  'audit failure leaves no first audit row'
);

select * from finish();
rollback;
