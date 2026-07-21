begin;
select plan(58);

select has_table(
  'core',
  'invitation_lifetime_policy',
  'protected invitation lifetime policy exists'
);
select ok(
  (
    select c.relrowsecurity and not c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'core'
       and c.relname = 'invitation_lifetime_policy'
  ),
  'policy RLS is enabled and not forced'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.invitation_lifetime_policy
  ),
  2,
  'Guide and Explorer policy rows exist'
);
select ok(
  (
    select pg_catalog.bool_and(
      minimum_hours = 1
      and active_hours = 24
      and maximum_hours = 168
      and retention_class = 'security_log'
    )
      from core.invitation_lifetime_policy
  ),
  'both initial policy rows use exact approved values'
);
select ok(
  not has_table_privilege(
    'service_role',
    'core.invitation_lifetime_policy',
    'SELECT'
  ),
  'service role has no policy select'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'core.invitation_lifetime_policy',
    'SELECT'
  ),
  'authenticated has no policy select'
);
select ok(
  not has_table_privilege(
    'anon',
    'core.invitation_lifetime_policy',
    'SELECT'
  ),
  'anon has no policy select'
);
select has_function(
  'public',
  'solmind_issue_guide_invitation',
  array['uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'text'],
  'Admin-to-Guide issuance function exists'
);
select function_lang_is(
  'public',
  'solmind_issue_guide_invitation',
  array['uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'text'],
  'plpgsql',
  'issuance function is plpgsql'
);
select volatility_is(
  'public',
  'solmind_issue_guide_invitation',
  array['uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'text'],
  'volatile',
  'issuance function is volatile'
);
select is(
  (
    select pg_catalog.pg_get_function_result(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_guide_invitation'
  ),
  'TABLE(outcome text, guide_invite_id uuid, expires_at timestamp with time zone)',
  'issuance result shape is exact'
);
select ok(
  (
    select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_guide_invitation'
  ),
  'issuance is security definer'
);
select is(
  (
    select pg_catalog.pg_get_userbyid(p.proowner)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_guide_invitation'
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
       and p.proname = 'solmind_issue_guide_invitation'
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
       and p.proname = 'solmind_issue_guide_invitation'
  ),
  'issuance has bounded lock timeout'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_issue_guide_invitation(uuid,uuid,uuid,text,text,text,text)',
    'EXECUTE'
  ),
  'service role can execute issuance'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_issue_guide_invitation(uuid,uuid,uuid,text,text,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute issuance'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_issue_guide_invitation(uuid,uuid,uuid,text,text,text,text)',
    'EXECUTE'
  ),
  'anon cannot execute issuance'
);
select ok(
  not has_function_privilege(
    'public',
    'public.solmind_issue_guide_invitation(uuid,uuid,uuid,text,text,text,text)',
    'EXECUTE'
  ),
  'PUBLIC cannot execute issuance'
);
select ok(
  not has_table_privilege('service_role', 'core.guide_invite', 'SELECT'),
  'service role has no Guide invitation select'
);
select ok(
  not has_table_privilege('service_role', 'core.guide_invite', 'INSERT'),
  'service role has no Guide invitation insert'
);
select ok(
  not has_table_privilege('service_role', 'core.guide_invite', 'UPDATE'),
  'service role has no Guide invitation update'
);
select ok(
  not has_table_privilege('service_role', 'audit.audit_event', 'INSERT'),
  'service role has no direct audit insert'
);
select ok(
  (
    select p.prosrc like '%private.solmind_guide_invitation_domain_lock_keys%'
       and p.prosrc not like '%authorizing-domain:invitation-sibling:v1%'
       and p.prosrc like '%for update%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_guide_invitation'
  ),
  'issuance uses the canonical shared lock-key helper before row locking'
);
select ok(
  (
    select p.prosrc not like '%verification_challenge%'
       and p.prosrc not like '%authorizing_evidence_consumption%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_guide_invitation'
  ),
  'issuance never selects, locks, consumes, or invalidates evidence'
);
select ok(
  (
    select p.prosrc like '%identity.user_session%'
       and p.prosrc like '%active_role_context <> ''admin''%'
       and p.prosrc like '%role_code = ''admin''%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_guide_invitation'
  ),
  'active Admin session and role checks are embedded'
);
select ok(
  (
    select p.prosrc like '%identity.user_contact_method%'
       and p.prosrc like '%identity.user_account%'
       and p.prosrc like '%identity.user_role_assignment%'
       and p.prosrc like '%core.guide_profile%'
       and p.prosrc like '%solmind_guide_issue_existing_guide%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_guide_invitation'
  ),
  'issuance embeds the closed existing-Guide eligibility predicate'
);
select ok(
  (
    select p.prosrc like '%superseded_by_reissuance%'
       and p.prosrc like '%guide_invite_issued%'
       and p.prosrc like '%invitation_expired%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_guide_invitation'
  ),
  'closed audit vocabulary is embedded'
);
select ok(
  (
    select p.prosrc not like '%http%'
       and p.prosrc not like '%net.%'
       and p.prosrc not like '%auth.admin%'
       and p.prosrc not like '%insert into identity.user_session%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_guide_invitation'
  ),
  'issuance contains no provider IO or session creation'
);

select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    null, null, null, 'email', 'a@example.com', 'a@example.com', null
  )$$,
  'P0001',
  'solmind_guide_issue_invalid_request',
  'null selectors deny'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-0000-4000-8000-000000000001',
    'a27c0030-0000-4000-8000-000000000002',
    'a27c0030-0000-4000-8000-000000000003',
    'other', 'a@example.com', 'a@example.com', null
  )$$,
  'P0001',
  'solmind_guide_issue_invalid_contact',
  'unknown contact type denies'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-0000-4000-8000-000000000001',
    'a27c0030-0000-4000-8000-000000000002',
    'a27c0030-0000-4000-8000-000000000003',
    'email', 'A@example.com', 'A@example.com', null
  )$$,
  'P0001',
  'solmind_guide_issue_invalid_contact',
  'noncanonical email denies'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-0000-4000-8000-000000000001',
    'a27c0030-0000-4000-8000-000000000002',
    'a27c0030-0000-4000-8000-000000000003',
    'phone', '+012345678', '+012345678', null
  )$$,
  'P0001',
  'solmind_guide_issue_invalid_contact',
  'non-E164 phone denies'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-0000-4000-8000-000000000001',
    'a27c0030-0000-4000-8000-000000000002',
    'a27c0030-0000-4000-8000-000000000003',
    'email', 'a@example.com', 'a@example.com', repeat('x', 513)
  )$$,
  'P0001',
  'solmind_guide_issue_invalid_name',
  'overlong invited name denies before sanitization'
);
select throws_ok(
  $$select * from public.solmind_issue_guide_invitation(
    'a27c0030-0000-4000-8000-000000000001',
    'a27c0030-0000-4000-8000-000000000002',
    'a27c0030-0000-4000-8000-000000000003',
    'email', 'a@example.com', 'a@example.com', null
  )$$,
  'P0001',
  'solmind_guide_issue_unauthorized',
  'unknown Admin context denies'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_policies
     where schemaname in (
       'identity', 'core', 'audit', 'content', 'ai', 'methodology',
       'notification', 'scheduling'
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
         'identity', 'core', 'audit', 'content', 'ai', 'methodology',
         'notification', 'scheduling'
       )
  ),
  'all application tables retain RLS'
);
select ok(
  (
    select pg_catalog.obj_description(p.oid, 'pg_proc')
      like '%performs no delivery, provider IO, route, cookie%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_guide_invitation'
  ),
  'function comment preserves dormant no-effect boundary'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_issue_guide_invitation'
  ),
  1,
  'exactly one issuance overload exists'
);
select ok(
  (
    select pg_catalog.obj_description(c.oid, 'pg_class')
      like '%No app role has direct table access%'
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'core'
       and c.relname = 'invitation_lifetime_policy'
  ),
  'policy comment preserves access and mutation boundary'
);

select has_function(
  'public',
  'solmind_revoke_guide_invitation',
  array['uuid', 'uuid', 'uuid'],
  'Admin Guide-invitation revocation function exists'
);
select function_lang_is(
  'public',
  'solmind_revoke_guide_invitation',
  array['uuid', 'uuid', 'uuid'],
  'plpgsql',
  'revocation function is plpgsql'
);
select volatility_is(
  'public',
  'solmind_revoke_guide_invitation',
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
       and p.proname = 'solmind_revoke_guide_invitation'
  ),
  'TABLE(outcome text, guide_invite_id uuid, invite_status text, revoked_at timestamp with time zone)',
  'revocation result shape is exact'
);
select ok(
  (
    select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_guide_invitation'
  ),
  'revocation is security definer'
);
select is(
  (
    select pg_catalog.pg_get_userbyid(p.proowner)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_guide_invitation'
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
       and p.proname = 'solmind_revoke_guide_invitation'
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
       and p.proname = 'solmind_revoke_guide_invitation'
  ),
  'revocation has bounded lock timeout'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_revoke_guide_invitation(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'service role can execute revocation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_revoke_guide_invitation(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute revocation'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_revoke_guide_invitation(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'anon cannot execute revocation'
);
select ok(
  not has_function_privilege(
    'public',
    'public.solmind_revoke_guide_invitation(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'PUBLIC cannot execute revocation'
);
select ok(
  (
    select p.prosrc like '%private.solmind_guide_invitation_domain_lock_keys%'
       and p.prosrc like '%for update%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_guide_invitation'
  ),
  'revocation uses the canonical shared domain before invitation row locks'
);
select ok(
  (
    select p.prosrc like '%identity.user_session%'
       and p.prosrc like '%active_role_context <> ''admin''%'
       and p.prosrc like '%role_code = ''admin''%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_guide_invitation'
  ),
  'revocation embeds active Admin account, role, session, and ownership checks'
);
select ok(
  (
    select p.prosrc like '%admin_revoked%'
       and p.prosrc like '%invite_expired%'
       and p.prosrc not like '%delete from core.guide_invite%'
       and p.prosrc not like '%http%'
       and p.prosrc not like '%net.%'
       and p.prosrc not like '%auth.admin%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_guide_invitation'
  ),
  'revocation embeds exact audit vocabulary, deletes nothing, and performs no provider IO'
);
select throws_ok(
  $$select * from public.solmind_revoke_guide_invitation(
    null, null, null
  )$$,
  'P0001',
  'solmind_guide_revoke_invalid_request',
  'revocation null selectors deny'
);
select throws_ok(
  $$select * from public.solmind_revoke_guide_invitation(
    'a27c0030-0000-4000-8000-000000000001',
    'a27c0030-0000-4000-8000-000000000002',
    'a27c0030-0000-4000-8000-000000000003'
  )$$,
  'P0001',
  'solmind_guide_revoke_unauthorized',
  'revocation unknown Admin context denies without target disclosure'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_revoke_guide_invitation'
  ),
  1,
  'exactly one revocation overload exists'
);

select * from finish();
rollback;
