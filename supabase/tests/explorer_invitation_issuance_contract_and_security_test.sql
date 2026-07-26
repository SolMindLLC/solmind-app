begin;
select plan(66);

select has_table(
  'core',
  'invitation_lifetime_policy',
  'protected invitation lifetime policy exists'
);
select has_table(
  'core',
  'explorer_engagement_capacity_policy',
  'protected Explorer capacity policy exists'
);
select ok(
  (
    select c.relrowsecurity and not c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'core'
       and c.relname = 'invitation_lifetime_policy'
  ),
  'lifetime policy RLS is enabled and not forced'
);
select ok(
  (
    select c.relrowsecurity and not c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'core'
       and c.relname = 'explorer_engagement_capacity_policy'
  ),
  'capacity policy RLS is enabled and not forced'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.invitation_lifetime_policy
     where invitation_role = 'explorer'
       and minimum_hours = 1
       and active_hours = 24
       and maximum_hours = 168
       and retention_class = 'security_log'
  ),
  1,
  'Explorer lifetime row has the exact active and boundary values'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_engagement_capacity_policy
     where capacity_policy_name = 'open_invitation_maximum'
       and minimum_value = 1
       and active_value = 1
       and maximum_value = 10
       and retention_class = 'security_log'
  ),
  1,
  'open-invitation capacity row has the exact MVP0 values'
);
select ok(
  not has_table_privilege(
    'service_role',
    'core.invitation_lifetime_policy',
    'SELECT'
  ),
  'service role has no lifetime-policy select'
);
select ok(
  not has_table_privilege(
    'service_role',
    'core.explorer_engagement_capacity_policy',
    'SELECT'
  ),
  'service role has no capacity-policy select'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'core.explorer_engagement_capacity_policy',
    'SELECT'
  ),
  'authenticated has no capacity-policy select'
);
select ok(
  not has_table_privilege(
    'anon',
    'core.explorer_engagement_capacity_policy',
    'SELECT'
  ),
  'anon has no capacity-policy select'
);

select has_function(
  'public',
  'solmind_issue_explorer_invitation',
  array[
    'uuid',
    'uuid',
    'uuid',
    'uuid',
    'uuid',
    'text',
    'text',
    'text',
    'text'
  ],
  'Guide-to-Explorer issuance function exists'
);
select function_lang_is(
  'public',
  'solmind_issue_explorer_invitation',
  array[
    'uuid',
    'uuid',
    'uuid',
    'uuid',
    'uuid',
    'text',
    'text',
    'text',
    'text'
  ],
  'plpgsql',
  'issuance function is plpgsql'
);
select volatility_is(
  'public',
  'solmind_issue_explorer_invitation',
  array[
    'uuid',
    'uuid',
    'uuid',
    'uuid',
    'uuid',
    'text',
    'text',
    'text',
    'text'
  ],
  'volatile',
  'issuance function is volatile'
);
select is(
  (
    select pg_catalog.pg_get_function_result(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  'TABLE(outcome text, explorer_invite_id uuid, expires_at timestamp with time zone)',
  'issuance result shape is exact'
);
select ok(
  (
    select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  'issuance is security definer'
);
select is(
  (
    select pg_catalog.pg_get_userbyid(p.proowner)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  'postgres',
  'issuance owner is postgres'
);
select ok(
  (
    select exists (
      select 1
        from pg_catalog.unnest(p.proconfig) setting
       where setting = 'search_path=""'
    )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  'issuance search path is empty'
);
select ok(
  (
    select exists (
      select 1
        from pg_catalog.unnest(p.proconfig) setting
       where setting = 'lock_timeout=2000ms'
    )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  'issuance has bounded lock timeout'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_issue_explorer_invitation(uuid,uuid,uuid,uuid,uuid,text,text,text,text)',
    'EXECUTE'
  ),
  'service role can execute issuance'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_issue_explorer_invitation(uuid,uuid,uuid,uuid,uuid,text,text,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute issuance'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_issue_explorer_invitation(uuid,uuid,uuid,uuid,uuid,text,text,text,text)',
    'EXECUTE'
  ),
  'anon cannot execute issuance'
);
select ok(
  not has_function_privilege(
    'public',
    'public.solmind_issue_explorer_invitation(uuid,uuid,uuid,uuid,uuid,text,text,text,text)',
    'EXECUTE'
  ),
  'PUBLIC cannot execute issuance'
);
select ok(
  not has_table_privilege(
    'service_role',
    'core.explorer_invite',
    'SELECT'
  ),
  'service role has no Explorer invitation select'
);
select ok(
  not has_table_privilege(
    'service_role',
    'core.explorer_invite',
    'INSERT'
  ),
  'service role has no Explorer invitation insert'
);
select ok(
  not has_table_privilege(
    'service_role',
    'core.explorer_invite',
    'UPDATE'
  ),
  'service role has no Explorer invitation update'
);
select ok(
  not has_table_privilege(
    'service_role',
    'audit.audit_event',
    'INSERT'
  ),
  'service role has no direct audit insert'
);
select ok(
  (
    select p.prosrc
           like '%private.solmind_explorer_invitation_domain_lock_keys%'
       and p.prosrc not like
           '%authorizing-domain:invitation-sibling:v1%'
       and p.prosrc like '%for update%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  'issuance uses the canonical Explorer lock-key helper before row locks'
);
select ok(
  (
    select p.prosrc like '%active_role_context <> ''guide''%'
       and p.prosrc like '%role_code = ''guide''%'
       and p.prosrc like '%setup_status <> ''approved''%'
       and p.prosrc like '%approval_status <> ''approved''%'
       and p.prosrc like
           '%relationship_status = ''active''%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  'issuance re-derives Guide, Practice, and membership authority'
);
select ok(
  (
    select p.prosrc like '%open_invitation_maximum%'
       and p.prosrc like '%solmind_explorer_issue_capacity_reached%'
       and p.prosrc like '%normalized_contact_value%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  'issuance embeds normalized-contact capacity enforcement'
);
select ok(
  (
    select p.prosrc like '%superseded_by_reissuance%'
       and p.prosrc like '%explorer_invite_issued%'
       and p.prosrc like '%guide_issued%'
       and p.prosrc like '%invitation_expired%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  'issuance embeds the exact Section 16.4 audit vocabulary'
);
select ok(
  (
    select p.prosrc like '%profile.explorer_profile_id%'
       and p.prosrc like '%core.guide_explorer_relationship%'
       and p.prosrc like
           '%solmind_explorer_issue_existing_relationship%'
       and p.prosrc like '%''invited''%'
       and p.prosrc like '%''intake_pending''%'
       and p.prosrc like '%''active''%'
       and p.prosrc like '%''paused''%'
       and p.prosrc not like '%invite_status = ''accepted''%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  'issuance checks the live same-Guide relationship without an accepted-history ban'
);
select ok(
  (
    select p.prosrc not like '%verification_challenge%'
       and p.prosrc not like '%authorizing_evidence_consumption%'
       and p.prosrc not like '%provider_provisioning_reservation%'
       and p.prosrc not like
           '%insert into core.guide_explorer_relationship%'
       and p.prosrc not like '%insert into identity.user_session%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  'issuance has no acceptance, evidence, reservation, relationship, or session effect'
);
select ok(
  (
    select p.prosrc not like '%http%'
       and p.prosrc not like '%net.%'
       and p.prosrc not like '%auth.admin%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  'issuance performs no provider or network IO'
);
select is(
  private.solmind_sanitize_invited_display_name(null, 'explorer'),
  'New Explorer',
  'null Explorer invitation name uses the neutral Explorer fallback'
);
select is(
  private.solmind_sanitize_invited_display_name(
    E'  Ada\t\nLovelace  ',
    'explorer'
  ),
  'Ada Lovelace',
  'Explorer sanitizer normalizes and collapses whitespace'
);
select is(
  private.solmind_sanitize_invited_display_name(
    E' \t\n ' || chr(8203) || chr(8238),
    'explorer'
  ),
  'New Explorer',
  'removed-format-only Explorer input uses the neutral fallback'
);
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    null,
    null,
    null,
    null,
    null,
    'email',
    'a@example.com',
    'a@example.com',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_invalid_request',
  'null selectors deny'
);
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-0000-4000-8000-000000000001',
    'a27d0030-0000-4000-8000-000000000002',
    'a27d0030-0000-4000-8000-000000000003',
    'a27d0030-0000-4000-8000-000000000004',
    'a27d0030-0000-4000-8000-000000000005',
    'other',
    'a@example.com',
    'a@example.com',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_invalid_contact',
  'unknown contact type denies'
);
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-0000-4000-8000-000000000001',
    'a27d0030-0000-4000-8000-000000000002',
    'a27d0030-0000-4000-8000-000000000003',
    'a27d0030-0000-4000-8000-000000000004',
    'a27d0030-0000-4000-8000-000000000005',
    'email',
    'A@example.com',
    'A@example.com',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_invalid_contact',
  'noncanonical email denies'
);
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-0000-4000-8000-000000000001',
    'a27d0030-0000-4000-8000-000000000002',
    'a27d0030-0000-4000-8000-000000000003',
    'a27d0030-0000-4000-8000-000000000004',
    'a27d0030-0000-4000-8000-000000000005',
    'phone',
    '+012345678',
    '+012345678',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_invalid_contact',
  'non-E164 phone denies'
);
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-0000-4000-8000-000000000001',
    'a27d0030-0000-4000-8000-000000000002',
    'a27d0030-0000-4000-8000-000000000003',
    'a27d0030-0000-4000-8000-000000000004',
    'a27d0030-0000-4000-8000-000000000005',
    'email',
    'a@example.com',
    'a@example.com',
    repeat('x', 513)
  )$$,
  'P0001',
  'solmind_explorer_issue_invalid_name',
  'overlong invited name denies before sanitization'
);
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-0000-4000-8000-000000000001',
    'a27d0030-0000-4000-8000-000000000002',
    'a27d0030-0000-4000-8000-000000000003',
    'a27d0030-0000-4000-8000-000000000004',
    'a27d0030-0000-4000-8000-000000000005',
    'email',
    'a@example.com',
    'a@example.com',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_unauthorized',
  'unknown Guide context denies'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  1,
  'exactly one issuance overload exists'
);
select ok(
  (
    select pg_catalog.obj_description(p.oid, 'pg_proc')
      like '%performs no acceptance, delivery, provider IO, route, cookie%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_explorer_invitation'
  ),
  'issuance comment preserves the dormant no-effect boundary'
);

select has_function(
  'public',
  'solmind_revoke_explorer_invitation',
  array['uuid', 'uuid', 'uuid'],
  'Guide-owned Explorer-invitation revocation function exists'
);
select function_lang_is(
  'public',
  'solmind_revoke_explorer_invitation',
  array['uuid', 'uuid', 'uuid'],
  'plpgsql',
  'revocation function is plpgsql'
);
select volatility_is(
  'public',
  'solmind_revoke_explorer_invitation',
  array['uuid', 'uuid', 'uuid'],
  'volatile',
  'revocation function is volatile'
);
select is(
  (
    select pg_catalog.pg_get_function_result(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_explorer_invitation'
  ),
  'TABLE(outcome text, explorer_invite_id uuid, invite_status text, revoked_at timestamp with time zone)',
  'revocation result shape is exact'
);
select ok(
  (
    select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_explorer_invitation'
  ),
  'revocation is security definer'
);
select is(
  (
    select pg_catalog.pg_get_userbyid(p.proowner)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_explorer_invitation'
  ),
  'postgres',
  'revocation owner is postgres'
);
select ok(
  (
    select exists (
      select 1
        from pg_catalog.unnest(p.proconfig) setting
       where setting = 'search_path=""'
    )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_explorer_invitation'
  ),
  'revocation search path is empty'
);
select ok(
  (
    select exists (
      select 1
        from pg_catalog.unnest(p.proconfig) setting
       where setting = 'lock_timeout=2000ms'
    )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_explorer_invitation'
  ),
  'revocation has bounded lock timeout'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_revoke_explorer_invitation(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'service role can execute revocation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_revoke_explorer_invitation(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute revocation'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_revoke_explorer_invitation(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'anon cannot execute revocation'
);
select ok(
  not has_function_privilege(
    'public',
    'public.solmind_revoke_explorer_invitation(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'PUBLIC cannot execute revocation'
);
select ok(
  (
    select p.prosrc
           like '%private.solmind_explorer_invitation_domain_lock_keys%'
       and p.prosrc like '%for update%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_explorer_invitation'
  ),
  'revocation uses the canonical shared domain before invitation row locks'
);
select ok(
  (
    select p.prosrc like '%active_role_context <> ''guide''%'
       and p.prosrc like '%role_code = ''guide''%'
       and p.prosrc like '%v_guide_profile.user_account_id <>%'
       and p.prosrc like '%v_practice.approval_status <> ''approved''%'
       and p.prosrc like '%relationship_status = ''active''%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_explorer_invitation'
  ),
  'revocation re-derives Guide ownership and active scope authority'
);
select ok(
  (
    select p.prosrc like '%guide_revoked%'
       and p.prosrc like '%invite_expired%'
       and p.prosrc not like '%delete from core.explorer_invite%'
       and p.prosrc not like '%http%'
       and p.prosrc not like '%net.%'
       and p.prosrc not like '%auth.admin%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_explorer_invitation'
  ),
  'revocation embeds exact audit, deletes nothing, and performs no provider IO'
);
select ok(
  (
    select p.prosrc like '%solmind_explorer_revoke_not_found%'
       and p.prosrc not like '%solmind_explorer_revoke_foreign%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_explorer_invitation'
  ),
  'absent and foreign targets share one value-free not-found class'
);
select throws_ok(
  $$select * from public.solmind_revoke_explorer_invitation(
    null,
    null,
    null
  )$$,
  'P0001',
  'solmind_explorer_revoke_invalid_request',
  'revocation null selectors deny'
);
select throws_ok(
  $$select * from public.solmind_revoke_explorer_invitation(
    'a27d0030-0000-4000-8000-000000000001',
    'a27d0030-0000-4000-8000-000000000002',
    'a27d0030-0000-4000-8000-000000000003'
  )$$,
  'P0001',
  'solmind_explorer_revoke_unauthorized',
  'revocation unknown Guide context denies without target disclosure'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_explorer_invitation'
  ),
  1,
  'exactly one revocation overload exists'
);
select ok(
  (
    select pg_catalog.obj_description(p.oid, 'pg_proc')
      like '%performs no acceptance, delivery, provider IO, route, cookie%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_explorer_invitation'
  ),
  'revocation comment preserves the dormant no-effect boundary'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from pg_policies
     where schemaname in (
       'identity',
       'core',
       'audit',
       'content',
       'ai',
       'methodology',
       'notification',
       'scheduling'
     )
  ),
  0,
  'no application RLS policies were introduced'
);
select ok(
  (
    select pg_catalog.bool_and(c.relrowsecurity)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'p')
       and n.nspname in (
         'identity',
         'core',
         'audit',
         'content',
         'ai',
         'methodology',
         'notification',
         'scheduling'
       )
  ),
  'all application tables retain RLS'
);

select * from finish();
rollback;
