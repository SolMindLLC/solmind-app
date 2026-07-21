begin;
create extension if not exists pgtap;
select plan(60);

select ok(
  exists (select 1 from pg_namespace where nspname = 'private'),
  'private schema exists'
);
select ok(
  exists (
    select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'private'
       and t.typname = 'solmind_invited_identity_result'
  ),
  'protected provisioning result type exists'
);
select is(
  (
    select pg_catalog.string_agg(
             a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod),
             ',' order by a.attnum
           )
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      join pg_class c on c.oid = t.typrelid
      join pg_attribute a on a.attrelid = c.oid
     where n.nspname = 'private'
       and t.typname = 'solmind_invited_identity_result'
       and a.attnum > 0
       and not a.attisdropped
  ),
  'user_account_id:uuid,account_created:boolean,user_contact_method_id:uuid,contact_created:boolean,auth_provider_identity_id:uuid,provider_identity_created:boolean,user_role_assignment_id:uuid,role_created:boolean,profile_id:uuid,profile_created:boolean',
  'protected result type has the exact identifier and created-flag contract'
);

select has_function(
  'private',
  'solmind_sanitize_invited_display_name',
  array['text','text'],
  'protected display-name sanitizer exists'
);
select has_function(
  'private',
  'solmind_provision_invited_guide_identity',
  array['uuid','uuid','text','text','text','text','text','uuid','text'],
  'protected Guide provisioning helper exists'
);
select has_function(
  'private',
  'solmind_guide_invitation_domain_lock_keys',
  array['uuid','text','text'],
  'canonical Guide invitation domain-lock key helper exists'
);
select is(
  (
    select pg_get_function_result(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_guide_invitation_domain_lock_keys'
  ),
  'bigint[]',
  'canonical Guide invitation domain-lock key helper returns bigint array'
);
select volatility_is(
  'private',
  'solmind_guide_invitation_domain_lock_keys',
  array['uuid','text','text'],
  'immutable',
  'canonical Guide invitation domain-lock key helper is immutable'
);
select ok(
  not (
    select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_guide_invitation_domain_lock_keys'
  ),
  'canonical Guide invitation domain-lock key helper is security invoker'
);
select is(
  (
    select pg_get_userbyid(p.proowner)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_guide_invitation_domain_lock_keys'
  ),
  'postgres',
  'canonical Guide invitation domain-lock key helper owner is postgres'
);
select is(
  (
    select p.proconfig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_guide_invitation_domain_lock_keys'
  ),
  array['search_path=""']::text[],
  'canonical Guide invitation domain-lock key helper pins empty search path'
);
select ok(
  not has_function_privilege(
    'service_role',
    'private.solmind_guide_invitation_domain_lock_keys(uuid,text,text)',
    'EXECUTE'
  ),
  'service_role cannot execute the canonical Guide lock-key helper'
);
select ok(
  (
    with keys as (
      select private.solmind_guide_invitation_domain_lock_keys(
               'a27c0041-0000-4000-8000-000000000001',
               'email',
               'lock-key@synthetic.invalid'
             ) as values
    )
    select pg_catalog.cardinality(values) = 3
       and values = (
         select pg_catalog.array_agg(key order by key)
           from pg_catalog.unnest(values) key
       )
       and pg_catalog.cardinality(values) = (
         select pg_catalog.count(distinct key)::integer
           from pg_catalog.unnest(values) key
       )
      from keys
  ),
  'canonical Guide lock-key helper returns three sorted unique keys'
);
select has_function(
  'public',
  'solmind_accept_guide_invitation',
  array['uuid','uuid','uuid','text','text'],
  'Guide acceptance entry exists'
);
select is(
  (
    select pg_get_function_result(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_guide_invitation'
  ),
  'TABLE(outcome text, user_account_id uuid, guide_profile_id uuid)',
  'Guide acceptance returns only the bounded outcome and entity identifiers'
);
select function_lang_is(
  'public',
  'solmind_accept_guide_invitation',
  array['uuid','uuid','uuid','text','text'],
  'plpgsql',
  'Guide acceptance is plpgsql'
);
select volatility_is(
  'public',
  'solmind_accept_guide_invitation',
  array['uuid','uuid','uuid','text','text'],
  'volatile',
  'Guide acceptance is volatile'
);
select ok(
  (
    select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_guide_invitation'
  ),
  'Guide acceptance is security definer'
);
select is(
  (
    select pg_get_userbyid(p.proowner)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_guide_invitation'
  ),
  'postgres',
  'Guide acceptance owner is postgres'
);
select is(
  (
    select p.proconfig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_guide_invitation'
  ),
  array['search_path=""','lock_timeout=2000ms']::text[],
  'Guide acceptance pins empty search path and bounded per-lock timeout'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_guide_invitation'
  ),
  1,
  'Guide acceptance has no overload'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_accept_guide_invitation(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'service_role can execute Guide acceptance'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_accept_guide_invitation(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'anon cannot execute Guide acceptance'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_accept_guide_invitation(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute Guide acceptance'
);
select ok(
  not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral pg_catalog.aclexplode(p.proacl) acl
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_guide_invitation'
       and acl.grantee = 0
       and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute Guide acceptance'
);
select ok(
  not has_function_privilege(
    'service_role',
    'private.solmind_provision_invited_guide_identity(uuid,uuid,text,text,text,text,text,uuid,text)',
    'EXECUTE'
  ),
  'service_role cannot execute the protected provisioning helper'
);
select ok(
  not has_function_privilege(
    'service_role',
    'private.solmind_sanitize_invited_display_name(text,text)',
    'EXECUTE'
  ),
  'service_role cannot execute the protected sanitizer'
);
select is(
  (
    select pg_get_userbyid(p.proowner)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_provision_invited_guide_identity'
  ),
  'postgres',
  'protected helper owner is postgres'
);
select ok(
  not (
    select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_provision_invited_guide_identity'
  ),
  'protected helper is security invoker under the outer definer'
);
select is(
  (
    select p.proconfig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_provision_invited_guide_identity'
  ),
  array['search_path=""']::text[],
  'protected helper pins an empty search path'
);
select is(
  (
    select p.provolatile
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_sanitize_invited_display_name'
  ),
  'i'::"char",
  'sanitizer is immutable'
);
select is(
  (
    select p.proconfig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_sanitize_invited_display_name'
  ),
  array['search_path=""']::text[],
  'sanitizer pins an empty search path'
);
select ok(
  not has_schema_privilege('service_role', 'private', 'USAGE'),
  'service_role has no private-schema usage'
);
select ok(
  not has_type_privilege(
    'service_role',
    'private.solmind_invited_identity_result',
    'USAGE'
  ),
  'service_role has no protected-result-type usage'
);

select ok(
  (
    select i.indisunique
      from pg_index i
     where i.indexrelid = 'core.guide_invite_one_open_contact_idx'::regclass
  ),
  'Guide one-open-contact index is unique'
);
select is(
  (
    select pg_get_indexdef(indexrelid)
      from pg_index
     where indexrelid = 'core.guide_invite_one_open_contact_idx'::regclass
  ),
  'CREATE UNIQUE INDEX guide_invite_one_open_contact_idx ON core.guide_invite USING btree (contact_method_type, normalized_contact_value) WHERE (invite_status = ANY (ARRAY[''created''::text, ''sent''::text]))',
  'Guide one-open-contact index has the exact key and predicate'
);
select ok(
  (
    select c.relrowsecurity
      from pg_class c
     where c.oid = 'core.guide_invite'::regclass
  ),
  'Guide invitation RLS remains enabled'
);
select ok(
  (
    select c.relrowsecurity
      from pg_class c
     where c.oid = 'identity.authorizing_evidence_consumption'::regclass
  ),
  'authorizing-evidence RLS remains enabled'
);
select ok(
  (
    select c.relrowsecurity
      from pg_class c
     where c.oid = 'identity.auth_provider_identity'::regclass
  ),
  'provider-identity RLS remains enabled'
);
select ok(
  not has_table_privilege('service_role', 'core.guide_invite', 'UPDATE'),
  'service_role receives no direct Guide-invitation update'
);
select ok(
  not has_table_privilege('service_role', 'identity.user_account', 'INSERT'),
  'service_role receives no direct account insert'
);
select ok(
  not has_table_privilege(
    'service_role',
    'identity.authorizing_evidence_consumption',
    'INSERT'
  ),
  'service_role receives no direct evidence-consumption insert'
);

select ok(
  (
    select p.prosrc like '%identity.authorizing_evidence_consumption%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_guide_invitation'
  ),
  'Guide acceptance embeds shared evidence consumption'
);
select ok(
  (
    select p.prosrc like '%private.solmind_provision_invited_guide_identity%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_guide_invitation'
  ),
  'Guide acceptance invokes only the protected provisioning helper'
);
select ok(
  (
    select p.prosrc like '%private.solmind_guide_invitation_domain_lock_keys%'
       and p.prosrc not like '%authorizing-domain:invitation-sibling:v1%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_guide_invitation'
  ),
  'Guide acceptance uses the canonical shared invitation lock-key helper'
);
select ok(
  (
    select p.prosrc like '%invite_accepted%'
       and p.prosrc like '%invite_revoked%'
       and p.prosrc not like '%solmind_record_audit_event%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_guide_invitation'
  ),
  'Guide acceptance embeds acceptance and sibling audit rows directly'
);
select ok(
  (
    select p.prosrc not like '%user_session%'
       and p.prosrc not like '%consent_record%'
       and p.prosrc not like '%guide_explorer_relationship%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_accept_guide_invitation'
  ),
  'Guide acceptance source excludes session, consent, and Explorer relationship writes'
);

select is(
  private.solmind_sanitize_invited_display_name(null, 'guide'),
  'New Guide',
  'null invitation name uses neutral Guide fallback'
);
select is(
  private.solmind_sanitize_invited_display_name(E'  Ada\t\nLovelace  ', 'guide'),
  'Ada Lovelace',
  'sanitizer normalizes and collapses whitespace'
);
select is(
  private.solmind_sanitize_invited_display_name(
    'A' || chr(8203) || 'd' || chr(8238) || 'a',
    'guide'
  ),
  'Ada',
  'sanitizer removes zero-width and bidirectional formatting characters'
);
select is(
  private.solmind_sanitize_invited_display_name(
    repeat('x', 121),
    'guide'
  ),
  repeat('x', 120),
  'sanitizer truncates to 120 Unicode code points'
);
select is(
  char_length(
    private.solmind_sanitize_invited_display_name(
      repeat(chr(128578), 121),
      'guide'
    )
  ),
  120,
  'sanitizer truncates multi-byte emoji by Unicode code point'
);
select is(
  private.solmind_sanitize_invited_display_name(
    'A' || chr(1) || 'd' || chr(127) || 'a',
    'guide'
  ),
  'Ada',
  'sanitizer removes reviewed control characters'
);
select is(
  private.solmind_sanitize_invited_display_name(
    E' \t\n ' || chr(8203) || chr(8238),
    'guide'
  ),
  'New Guide',
  'whitespace and removed-format-only input uses the neutral fallback'
);
select is(
  private.solmind_sanitize_invited_display_name(repeat('x', 119), 'guide'),
  repeat('x', 119),
  'sanitizer preserves exactly 119 code points'
);
select is(
  private.solmind_sanitize_invited_display_name(repeat('x', 120), 'guide'),
  repeat('x', 120),
  'sanitizer preserves exactly 120 code points'
);
select is(
  private.solmind_sanitize_invited_display_name(
    repeat('e' || chr(769), 60),
    'guide'
  ),
  repeat('e' || chr(769), 60),
  'sanitizer preserves a 120-code-point combining-character sequence'
);
select ok(
  pg_catalog.char_length(
    private.solmind_sanitize_invited_display_name(
      repeat('e' || chr(769), 61),
      'guide'
    )
  ) between 1 and 120,
  'sanitizer never returns empty or more than 120 code points for combining input'
);
select throws_ok(
  $$select private.solmind_sanitize_invited_display_name('Name', 'admin')$$,
  'P0001',
  'solmind_invited_identity_invalid_role',
  'sanitizer rejects non-enumerated roles'
);
select is(
  (
    select pg_catalog.array_agg(a.name order by a.ordinality)
      from unnest(
        (
          select p.proargnames
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname = 'solmind_accept_guide_invitation'
        )
      ) with ordinality as a(name, ordinality)
     where a.ordinality <= 5
  ),
  array[
    'p_guide_invite_id',
    'p_verification_challenge_id',
    'p_provisioning_reservation_id',
    'p_provider_user_id',
    'p_normalized_provider_email'
  ]::text[],
  'Guide acceptance has the exact five input names'
);

select * from finish();
rollback;
