begin;
select plan(40);

select has_table(
  'core',
  'explorer_engagement_capacity_policy',
  'protected Explorer engagement capacity policy exists'
);
select ok(
  (
    select c.relrowsecurity and not c.relforcerowsecurity
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'core'
       and c.relname = 'explorer_engagement_capacity_policy'
  ),
  'capacity policy RLS is enabled and not forced'
);
select is(
  (select pg_catalog.count(*)::integer from core.explorer_engagement_capacity_policy),
  2,
  'capacity policy has exactly two fixed rows'
);
select is(
  (
    select pg_catalog.string_agg(capacity_policy_name, ',' order by capacity_policy_name)
      from core.explorer_engagement_capacity_policy
  ),
  'current_guide_relationship_maximum,open_invitation_maximum',
  'capacity policy has the exact approved fixed names'
);
select ok(
  (
    select pg_catalog.bool_and(
      minimum_value = 1
      and active_value = 1
      and maximum_value = 10
      and retention_class = 'security_log'
    )
      from core.explorer_engagement_capacity_policy
  ),
  'both policy rows use the approved 1..10 bounds and MVP0 value 1'
);
select throws_ok(
  $$update core.explorer_engagement_capacity_policy
       set active_value = 0
     where capacity_policy_name = 'open_invitation_maximum'$$,
  '23514',
  'new row for relation "explorer_engagement_capacity_policy" violates check constraint "explorer_engagement_capacity_policy_values_check"',
  'capacity policy rejects zero'
);
select throws_ok(
  $$update core.explorer_engagement_capacity_policy
       set active_value = 11
     where capacity_policy_name = 'current_guide_relationship_maximum'$$,
  '23514',
  'new row for relation "explorer_engagement_capacity_policy" violates check constraint "explorer_engagement_capacity_policy_values_check"',
  'capacity policy rejects eleven'
);
select throws_ok(
  $$insert into core.explorer_engagement_capacity_policy (
       capacity_policy_name, minimum_value, active_value, maximum_value
     ) values ('open_invitation_maximum', 1, 1, 10)$$,
  '23505',
  'duplicate key value violates unique constraint "explorer_engagement_capacity_policy_pkey"',
  'capacity policy rejects a duplicate fixed row'
);
select ok(
  not has_table_privilege('service_role', 'core.explorer_engagement_capacity_policy', 'SELECT')
  and not has_table_privilege('service_role', 'core.explorer_engagement_capacity_policy', 'INSERT')
  and not has_table_privilege('service_role', 'core.explorer_engagement_capacity_policy', 'UPDATE')
  and not has_table_privilege('service_role', 'core.explorer_engagement_capacity_policy', 'DELETE'),
  'service role has no direct capacity-policy access'
);
select ok(
  not has_table_privilege('authenticated', 'core.explorer_engagement_capacity_policy', 'SELECT')
  and not has_table_privilege('authenticated', 'core.explorer_engagement_capacity_policy', 'INSERT')
  and not has_table_privilege('authenticated', 'core.explorer_engagement_capacity_policy', 'UPDATE')
  and not has_table_privilege('authenticated', 'core.explorer_engagement_capacity_policy', 'DELETE'),
  'authenticated has no direct capacity-policy access'
);
select ok(
  not has_table_privilege('anon', 'core.explorer_engagement_capacity_policy', 'SELECT')
  and not has_table_privilege('anon', 'core.explorer_engagement_capacity_policy', 'INSERT')
  and not has_table_privilege('anon', 'core.explorer_engagement_capacity_policy', 'UPDATE')
  and not has_table_privilege('anon', 'core.explorer_engagement_capacity_policy', 'DELETE'),
  'anon has no direct capacity-policy access'
);
select ok(
  not has_table_privilege('public', 'core.explorer_engagement_capacity_policy', 'SELECT')
  and not has_table_privilege('public', 'core.explorer_engagement_capacity_policy', 'INSERT')
  and not has_table_privilege('public', 'core.explorer_engagement_capacity_policy', 'UPDATE')
  and not has_table_privilege('public', 'core.explorer_engagement_capacity_policy', 'DELETE'),
  'PUBLIC has no direct capacity-policy access'
);

select has_index(
  'core',
  'explorer_invite',
  'explorer_invite_one_open_scope_idx',
  'one-open-Explorer-invitation scope index exists'
);
select ok(
  (
    select i.indisunique
      from pg_catalog.pg_index i
      join pg_catalog.pg_class c on c.oid = i.indexrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'core'
       and c.relname = 'explorer_invite_one_open_scope_idx'
  ),
  'one-open-scope index is unique'
);
select is(
  (
    select pg_catalog.pg_get_indexdef(c.oid)
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'core'
       and c.relname = 'explorer_invite_one_open_scope_idx'
  ),
  'CREATE UNIQUE INDEX explorer_invite_one_open_scope_idx ON core.explorer_invite USING btree (guide_profile_id, practice_id, contact_method_type, normalized_contact_value) WHERE (invite_status = ANY (ARRAY[''created''::text, ''sent''::text]))',
  'one-open-scope index has the exact keys and open-state predicate'
);
select has_index(
  'core',
  'guide_explorer_relationship',
  'guide_explorer_relationship_one_invite_origin_idx',
  'one-relationship-per-invitation provenance index exists'
);
select ok(
  (
    select i.indisunique
      from pg_catalog.pg_index i
      join pg_catalog.pg_class c on c.oid = i.indexrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'core'
       and c.relname = 'guide_explorer_relationship_one_invite_origin_idx'
  ),
  'invitation-provenance index is unique'
);
select is(
  (
    select pg_catalog.pg_get_indexdef(c.oid)
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'core'
       and c.relname = 'guide_explorer_relationship_one_invite_origin_idx'
  ),
  'CREATE UNIQUE INDEX guide_explorer_relationship_one_invite_origin_idx ON core.guide_explorer_relationship USING btree (created_from_invite_id) WHERE (created_from_invite_id IS NOT NULL)',
  'invitation-provenance index has the exact key and predicate'
);
select has_index(
  'core',
  'guide_explorer_relationship',
  'guide_explorer_relationship_one_active_pair_idx',
  'banked live Guide-Explorer pair index remains present'
);
select is(
  (
    select pg_catalog.pg_get_indexdef(c.oid)
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'core'
       and c.relname = 'guide_explorer_relationship_one_active_pair_idx'
  ),
  'CREATE UNIQUE INDEX guide_explorer_relationship_one_active_pair_idx ON core.guide_explorer_relationship USING btree (guide_profile_id, explorer_profile_id) WHERE (relationship_status = ANY (ARRAY[''invited''::text, ''intake_pending''::text, ''active''::text, ''paused''::text]))',
  'banked live-pair index retains the exact counted-state predicate'
);
select has_index(
  'core',
  'explorer_profile',
  'explorer_profile_one_non_deleted_per_user_idx',
  'banked one-nondeleted-Explorer-profile index remains present'
);
select is(
  (
    select pg_catalog.pg_get_indexdef(c.oid)
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'core'
       and c.relname = 'explorer_profile_one_non_deleted_per_user_idx'
  ),
  'CREATE UNIQUE INDEX explorer_profile_one_non_deleted_per_user_idx ON core.explorer_profile USING btree (user_account_id) WHERE (status <> ''deleted''::text)',
  'banked Explorer-profile index retains its exact predicate'
);
select has_index(
  'core',
  'guide_explorer_relationship',
  'guide_explorer_relationship_created_from_invite_idx',
  'pre-existing nonunique invitation lookup index is retained'
);

select has_function(
  'private',
  'solmind_explorer_invitation_domain_lock_keys',
  array['uuid', 'uuid', 'uuid', 'text', 'text'],
  'canonical Explorer invitation domain-lock helper exists'
);
select is(
  (
    select pg_catalog.pg_get_function_result(p.oid)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_explorer_invitation_domain_lock_keys'
  ),
  'bigint[]',
  'Explorer lock-key helper returns bigint array'
);
select function_lang_is(
  'private',
  'solmind_explorer_invitation_domain_lock_keys',
  array['uuid', 'uuid', 'uuid', 'text', 'text'],
  'sql',
  'Explorer lock-key helper is SQL'
);
select volatility_is(
  'private',
  'solmind_explorer_invitation_domain_lock_keys',
  array['uuid', 'uuid', 'uuid', 'text', 'text'],
  'immutable',
  'Explorer lock-key helper is immutable'
);
select ok(
  not (
    select p.prosecdef
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_explorer_invitation_domain_lock_keys'
  ),
  'Explorer lock-key helper is security invoker'
);
select is(
  (
    select pg_catalog.pg_get_userbyid(p.proowner)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_explorer_invitation_domain_lock_keys'
  ),
  'postgres',
  'Explorer lock-key helper owner is postgres'
);
select is(
  (
    select p.proconfig
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_explorer_invitation_domain_lock_keys'
  ),
  array['search_path=""']::text[],
  'Explorer lock-key helper pins empty search path'
);
select ok(
  not has_function_privilege(
    'service_role',
    'private.solmind_explorer_invitation_domain_lock_keys(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'service role cannot execute the protected Explorer lock-key helper'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.solmind_explorer_invitation_domain_lock_keys(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute the protected Explorer lock-key helper'
);
select ok(
  not has_function_privilege(
    'anon',
    'private.solmind_explorer_invitation_domain_lock_keys(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'anon cannot execute the protected Explorer lock-key helper'
);
select ok(
  not has_function_privilege(
    'public',
    'private.solmind_explorer_invitation_domain_lock_keys(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'PUBLIC cannot execute the protected Explorer lock-key helper'
);
select ok(
  (
    with keys as (
      select private.solmind_explorer_invitation_domain_lock_keys(
               'a27c0042-0000-4000-8000-000000000001',
               'a27c0042-0000-4000-8000-000000000002',
               'a27c0042-0000-4000-8000-000000000003',
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
  'Explorer lock-key helper returns exactly three sorted unique keys'
);
select is(
  private.solmind_explorer_invitation_domain_lock_keys(
    'a27c0042-0000-4000-8000-000000000001',
    'a27c0042-0000-4000-8000-000000000002',
    'a27c0042-0000-4000-8000-000000000003',
    'email',
    'lock-key@synthetic.invalid'
  ),
  (
    select pg_catalog.array_agg(key order by key)
      from (
        select distinct pg_catalog.hashtextextended(material, 0) as key
          from pg_catalog.unnest(array[
            'solmind:authorizing-domain:invitation:v1|role=8:explorer|invite=36:a27c0042-0000-4000-8000-000000000001',
            'solmind:authorizing-domain:contact:v1|type=5:email|value=26:lock-key@synthetic.invalid',
            'solmind:authorizing-domain:invitation-sibling:v1|role=8:explorer|guide=36:a27c0042-0000-4000-8000-000000000002|practice=36:a27c0042-0000-4000-8000-000000000003|type=5:email|value=26:lock-key@synthetic.invalid'
          ]::text[]) material
      ) expected
  ),
  'Explorer lock-key helper is byte-compatible with the banked P27-B materials'
);
select ok(
  (
    select p.prosrc like '%role=8:explorer%'
       and p.prosrc like '%|guide=36:%'
       and p.prosrc like '%|practice=36:%'
       and p.prosrc not like '%provider-email%'
       and p.prosrc not like '%authorizing-domain:account%'
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_explorer_invitation_domain_lock_keys'
  ),
  'Explorer helper owns only the invitation, contact, and scope-sibling lock domains'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'solmind_explorer_invitation_domain_lock_keys'
  ),
  1,
  'Explorer lock-key helper has no overload'
);
select ok(
  (
    select pg_catalog.array_agg(c.conname::text order by c.conname)
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_class t on t.oid = c.conrelid
      join pg_catalog.pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'core'
       and t.relname = 'explorer_engagement_capacity_policy'
       and c.contype = 'c'
  ) = array[
    'explorer_engagement_capacity_policy_bounds_check',
    'explorer_engagement_capacity_policy_name_check',
    'explorer_engagement_capacity_policy_retention_check',
    'explorer_engagement_capacity_policy_timestamps_check',
    'explorer_engagement_capacity_policy_values_check'
  ]::text[],
  'capacity policy has exactly the five named check constraints'
);
select ok(
  not exists (
    select 1
      from pg_catalog.pg_policies
     where schemaname = 'core'
       and tablename = 'explorer_engagement_capacity_policy'
  ),
  'capacity policy stays deny-by-default with no RLS policy'
);

select * from finish();
rollback;
