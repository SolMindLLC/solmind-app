begin;
select plan(42);

-- 1-13: public surface and posture.
select has_function(
  'public',
  'solmind_accept_explorer_invitation',
  array['uuid', 'uuid', 'uuid', 'text', 'text'],
  'Explorer invitation acceptance function exists'
);
select function_lang_is(
  'public',
  'solmind_accept_explorer_invitation',
  array['uuid', 'uuid', 'uuid', 'text', 'text'],
  'plpgsql',
  'acceptance function is plpgsql'
);
select volatility_is(
  'public',
  'solmind_accept_explorer_invitation',
  array['uuid', 'uuid', 'uuid', 'text', 'text'],
  'volatile',
  'acceptance function is volatile'
);
select is(
  (
    select pg_catalog.pg_get_function_result(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'TABLE(outcome text, user_account_id uuid, explorer_profile_id uuid, guide_explorer_relationship_id uuid)',
  'acceptance result shape is exact'
);
select ok(
  (
    select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'acceptance is security definer'
);
select is(
  (
    select pg_catalog.pg_get_userbyid(p.proowner)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'postgres',
  'acceptance owner is postgres'
);
select ok(
  (
    select 'search_path=""' = any (p.proconfig)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'acceptance search path is empty'
);
select ok(
  (
    select 'lock_timeout=2000ms' = any (p.proconfig)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'acceptance lock timeout is bounded'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_accept_explorer_invitation(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'service role can execute acceptance'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_accept_explorer_invitation(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute acceptance'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_accept_explorer_invitation(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'anon cannot execute acceptance'
);
select ok(
  not has_function_privilege(
    'public',
    'public.solmind_accept_explorer_invitation(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'public cannot execute acceptance'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  1,
  'acceptance has no overload'
);

-- 14-29: source-level transaction, lock-order, and write boundaries.
select ok(
  (
    select p.prosrc like
      '%private.solmind_explorer_invitation_domain_lock_keys(%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'acceptance uses the canonical Explorer domain-lock helper'
);
select ok(
  (
    select strpos(p.prosrc, 'pg_advisory_xact_lock(v_evidence_lock_key)')
             < strpos(p.prosrc, 'foreach v_domain_lock_key in array v_domain_lock_keys')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'evidence lock precedes remaining domain locks'
);
select ok(
  (
    select strpos(p.prosrc, 'foreach v_domain_lock_key in array v_domain_lock_keys')
             < strpos(p.prosrc, 'select reservation.*')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'domain locks precede reservation row lock'
);
select ok(
  (
    select strpos(p.prosrc, 'select reservation.*')
             < strpos(p.prosrc, 'perform invitation.explorer_invite_id')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'reservation lock precedes invitation row locks'
);
select ok(
  (
    select strpos(p.prosrc, 'into v_candidate_user_account_ids')
             < strpos(
                 p.prosrc,
                 'where account.user_account_id = any (v_candidate_user_account_ids)'
               )
           and strpos(
                 p.prosrc,
                 'where account.user_account_id = any (v_candidate_user_account_ids)'
               ) < strpos(
                 p.prosrc,
                 E'where contact.contact_method_type = v_invite.contact_method_type\n       and contact.normalized_contact_value = v_invite.normalized_contact_value\n     order by contact.user_contact_method_id\n       for share'
               )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'candidate-account discovery precedes account then contact row locking'
);
select ok(
  (
    select strpos(
             p.prosrc,
             E'where contact.contact_method_type = v_invite.contact_method_type\n       and contact.normalized_contact_value = v_invite.normalized_contact_value\n     order by contact.user_contact_method_id\n       for share'
           ) < strpos(
             p.prosrc,
             'where profile.user_account_id = any (v_locked_user_account_ids)'
           )
       and strpos(
             p.prosrc,
             'where profile.user_account_id = any (v_locked_user_account_ids)'
           ) < strpos(
             p.prosrc,
             'where relationship.explorer_profile_id ='
           )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'contact locks precede Explorer profile then relationship locks'
);
select ok(
  (
    select strpos(
             p.prosrc,
             E'if v_challenge.user_account_id is not null then\n      if exists (\n        select 1\n          from core.guide_explorer_relationship relationship'
           ) < strpos(p.prosrc, 'private.solmind_provision_invited_identity(')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'defensive same-pair check precedes provisioning'
);
select ok(
  (
    select strpos(p.prosrc, 'solmind_explorer_accept_capacity_reached')
             < strpos(p.prosrc, 'private.solmind_provision_invited_identity(')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'capacity denial precedes provisioning and every write'
);
select ok(
  (
    select p.prosrc like
             '%private.solmind_provision_invited_identity(%'
           and p.prosrc not like
             '%private.solmind_provision_invited_guide_identity(%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'acceptance uses only the shared invited-identity helper'
);
select ok(
  (
    select p.prosrc like
      '%''explorer_invitation_acceptance''%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'acceptance consumes evidence with the exact Explorer consumer type'
);
select ok(
  (
    select p.prosrc like '%''intake_pending''%'
           and p.prosrc like '%created_from_invite_id%'
           and p.prosrc like '%created_by_user_account_id%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'relationship write includes the frozen status, provenance, and creator pins'
);
select ok(
  (
    select strpos(p.prosrc, 'if v_invite.invite_status = ''accepted'' then')
             < strpos(p.prosrc, 'if v_consumption_found then')
           and substring(
                 p.prosrc
                 from strpos(
                   p.prosrc,
                   'if v_invite.invite_status = ''accepted'' then'
                 )
                 for strpos(p.prosrc, 'if v_consumption_found then')
                   - strpos(
                       p.prosrc,
                       'if v_invite.invite_status = ''accepted'' then'
                     )
               ) like
                 '%v_challenge.purpose not in (''contact_verify'', ''login'')%'
           and substring(
                 p.prosrc
                 from strpos(
                   p.prosrc,
                   'if v_invite.invite_status = ''accepted'' then'
                 )
                 for strpos(p.prosrc, 'if v_consumption_found then')
                   - strpos(
                       p.prosrc,
                       'if v_invite.invite_status = ''accepted'' then'
                     )
               ) like
                 '%v_challenge.user_account_id is null%v_challenge.user_contact_method_id is not null%'
           and substring(
                 p.prosrc
                 from strpos(
                   p.prosrc,
                   'if v_invite.invite_status = ''accepted'' then'
                 )
                 for strpos(p.prosrc, 'if v_consumption_found then')
                   - strpos(
                       p.prosrc,
                       'if v_invite.invite_status = ''accepted'' then'
                     )
               ) like
                 '%v_challenge.user_account_id is not null%v_challenge.user_contact_method_id is null%'
           and substring(
                 p.prosrc
                 from strpos(
                   p.prosrc,
                   'if v_invite.invite_status = ''accepted'' then'
                 )
                 for strpos(p.prosrc, 'if v_consumption_found then')
                   - strpos(
                       p.prosrc,
                       'if v_invite.invite_status = ''accepted'' then'
                     )
               ) like
                 '%v_challenge.purpose = ''login''%v_challenge.user_account_id is null%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'exact committed recovery precedes evidence-consumed denial'
);
select ok(
  (
    select p.prosrc like
             '%invitation.guide_profile_id = v_invite.guide_profile_id%'
           and p.prosrc like
             '%invitation.practice_id = v_invite.practice_id%'
           and p.prosrc like
             '%invitation.contact_method_type = v_invite.contact_method_type%'
           and p.prosrc like
             '%invitation.normalized_contact_value =%v_invite.normalized_contact_value%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'sibling revocation is limited to the accepted Guide, Practice, and contact scope'
);
select ok(
  (
    select p.prosrc like '%when lock_not_available or query_canceled%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'acceptance maps caller cancellation and lock failures'
);
select ok(
  (
    select p.prosrc not like '%solmind_record_audit_event%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'acceptance embeds audit rows without the app audit writer'
);
select ok(
  (
    select p.prosrc like '%guide_explorer_relationship_created%'
           and p.prosrc like '%profile_onboarding_changed%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'acceptance includes relationship and re-entry audit vocabulary'
);

-- 30-34: fixed error family and privacy-safe audit vocabulary.
select is(
  (
    select pg_catalog.count(*)::integer
      from (
        values
          ('solmind_explorer_accept_invalid_request'::text),
          ('solmind_explorer_accept_ineligible'::text),
          ('solmind_explorer_accept_evidence_consumed'::text),
          ('solmind_explorer_accept_stale_evidence'::text),
          ('solmind_explorer_accept_policy_unavailable'::text),
          ('solmind_explorer_accept_capacity_reached'::text),
          ('solmind_explorer_accept_conflict'::text),
          ('solmind_explorer_accept_integrity_failure'::text),
          ('solmind_explorer_accept_lock_unavailable'::text)
      ) expected(error_class)
     where (
       select p.prosrc like '%' || expected.error_class || '%'
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'solmind_accept_explorer_invitation'
     )
  ),
  9,
  'acceptance source contains every fixed error class'
);
select ok(
  (
    select p.prosrc not like
             '%jsonb_build_object(''provider_user_id''%'
           and p.prosrc not like
             '%jsonb_build_object(''provider_email''%'
           and p.prosrc not like
             '%jsonb_build_object(''normalized_contact_value''%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'audit metadata does not include provider-user or contact parameters'
);
select ok(
  (
    select p.prosrc like '%''Invitation accepted.''%'
           and p.prosrc like
             '%''Guide-Explorer relationship created from invitation.''%'
           and p.prosrc like
             '%''Sibling invitation revoked after acceptance.''%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'acceptance uses the fixed audit summaries'
);
select ok(
  (
    select obj_description(p.oid, 'pg_proc') like
             '%No provider IO, route, caller, cookie, session, consent%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_explorer_invitation'
  ),
  'function comment preserves the dormant non-effects boundary'
);
select ok(
  not has_function_privilege(
    'service_role',
    'private.solmind_provision_invited_identity(uuid,uuid,text,text,text,text,text,text,uuid,text)',
    'EXECUTE'
  ),
  'shared protected helper remains non-callable by service role'
);

-- 35-42: replaced preparation function correction coverage.
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  1,
  'Explorer preparation still has one overload'
);
select ok(
  (
    select p.prosrc like
      '%capacity_policy_name = ''current_guide_relationship_maximum''%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'preparation reads the exact current-relationship capacity policy'
);
select ok(
  (
    select p.prosrc like '%solmind_invitation_prepare_policy_unavailable%'
           and p.prosrc like '%solmind_invitation_prepare_ineligible%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'preparation preserves distinct existing policy-failure and denial classes'
);
select ok(
  (
    select strpos(
             p.prosrc,
             'capacity_policy_name = ''current_guide_relationship_maximum'''
           ) < strpos(p.prosrc, 'if v_existing_reservation then')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'capacity pre-check precedes reservation recovery or creation'
);
select ok(
  (
    select strpos(p.prosrc, 'from core.practice_guide practice_guide')
             < strpos(
                 p.prosrc,
                 'capacity_policy_name = ''current_guide_relationship_maximum'''
               )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'capacity pre-check follows the banked Guide and Practice eligibility order'
);
select ok(
  (
    select strpos(p.prosrc, 'perform profile.explorer_profile_id')
             < strpos(
                 p.prosrc,
                 'perform relationship.guide_explorer_relationship_id'
               )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'preparation locks Explorer profiles before relationships'
);
select ok(
  (
    select p.prosrc not like
             '%insert into core.guide_explorer_relationship%'
           and p.prosrc not like
             '%insert into identity.authorizing_evidence_consumption%'
           and p.prosrc not like '%update core.explorer_invite%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'preparation capacity check remains evidence, invite, and relationship writeless'
);
select ok(
  (
    select obj_description(p.oid, 'pg_proc') like
      '%Capacity denial is writeless and generic%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'preparation comment records the non-authoritative privacy-safe pre-check'
);

select * from finish();
rollback;
