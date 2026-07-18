begin;
select plan(90);

select has_table(
  'identity',
  'invitation_acceptance_freshness_policy',
  'invitation acceptance freshness policy exists'
);
select columns_are(
  'identity',
  'invitation_acceptance_freshness_policy',
  array[
    'policy_name',
    'minimum_seconds',
    'active_seconds',
    'maximum_seconds',
    'retention_class',
    'created_at',
    'updated_at'
  ],
  'invitation acceptance freshness policy has exact bounded columns'
);
select results_eq(
  $$select policy_name,minimum_seconds,active_seconds,maximum_seconds,retention_class
      from identity.invitation_acceptance_freshness_policy$$,
  $$select 'invitation_acceptance_evidence_freshness'::text,60,300,600,'security_log'::text$$,
  'freshness policy has the exact initial fixed row'
);
select is(
  (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conrelid = 'identity.invitation_acceptance_freshness_policy'::regclass
       and contype = 'p'
  ),
  'PRIMARY KEY (policy_name)',
  'freshness policy fixed name is the structural singleton key'
);
select ok(
  (
    select relrowsecurity and not relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'identity'
       and c.relname = 'invitation_acceptance_freshness_policy'
  ),
  'freshness policy RLS is enabled and not forced'
);
select is(
  (
    select count(*)::integer
      from pg_policies
     where schemaname = 'identity'
       and tablename = 'invitation_acceptance_freshness_policy'
  ),
  0,
  'freshness policy has zero policies'
);
select ok(
  not has_table_privilege(
    'service_role',
    'identity.invitation_acceptance_freshness_policy',
    'SELECT'
  ),
  'service_role cannot read the freshness policy directly'
);
select ok(
  not has_table_privilege(
    'service_role',
    'identity.invitation_acceptance_freshness_policy',
    'INSERT'
  ),
  'service_role cannot insert freshness policy directly'
);
select ok(
  not has_table_privilege(
    'service_role',
    'identity.invitation_acceptance_freshness_policy',
    'UPDATE'
  ),
  'service_role cannot update freshness policy directly'
);
select ok(
  not has_table_privilege(
    'service_role',
    'identity.invitation_acceptance_freshness_policy',
    'DELETE'
  ),
  'service_role cannot delete freshness policy directly'
);
select ok(
  not has_table_privilege(
    'anon',
    'identity.invitation_acceptance_freshness_policy',
    'SELECT'
  ),
  'anon cannot read the freshness policy'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'identity.invitation_acceptance_freshness_policy',
    'SELECT'
  ),
  'authenticated cannot read the freshness policy'
);
select is(
  obj_description(
    'identity.invitation_acceptance_freshness_policy'::regclass,
    'pg_class'
  ),
  'Protected P27-B evidence-freshness policy for new invitation-acceptance preparation. The fixed 60/300/600 initial values may later be changed only through a separately approved restricted audited operation. No app role has direct table access.',
  'freshness-policy comment preserves configuration and access limits'
);

select has_table(
  'identity',
  'auth_provider_provisioning_reservation',
  'provider-provisioning reservation table exists'
);
select columns_are(
  'identity',
  'auth_provider_provisioning_reservation',
  array[
    'provisioning_reservation_id',
    'guide_invite_id',
    'explorer_invite_id',
    'provider_name',
    'created_at',
    'expires_at',
    'retention_class'
  ],
  'provider-provisioning reservation has exact bounded columns'
);
select ok(
  (
    select relrowsecurity and not relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'identity'
       and c.relname = 'auth_provider_provisioning_reservation'
  ),
  'reservation RLS is enabled and not forced'
);
select is(
  (
    select count(*)::integer
      from pg_policies
     where schemaname = 'identity'
       and tablename = 'auth_provider_provisioning_reservation'
  ),
  0,
  'reservation has zero policies'
);
select ok(
  not has_table_privilege(
    'service_role',
    'identity.auth_provider_provisioning_reservation',
    'SELECT'
  ),
  'service_role cannot read reservations directly'
);
select ok(
  not has_table_privilege(
    'service_role',
    'identity.auth_provider_provisioning_reservation',
    'INSERT'
  ),
  'service_role cannot insert reservations directly'
);
select ok(
  not has_table_privilege(
    'service_role',
    'identity.auth_provider_provisioning_reservation',
    'UPDATE'
  ),
  'service_role cannot update reservations directly'
);
select ok(
  not has_table_privilege(
    'service_role',
    'identity.auth_provider_provisioning_reservation',
    'DELETE'
  ),
  'service_role cannot delete reservations directly'
);
select ok(
  not has_table_privilege(
    'anon',
    'identity.auth_provider_provisioning_reservation',
    'SELECT'
  ),
  'anon cannot read reservations'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'identity.auth_provider_provisioning_reservation',
    'SELECT'
  ),
  'authenticated cannot read reservations'
);
select is(
  (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conrelid = 'identity.auth_provider_provisioning_reservation'::regclass
       and conname = 'auth_provider_provisioning_reservation_invite_xor_check'
  ),
  'CHECK (((guide_invite_id IS NULL) <> (explorer_invite_id IS NULL)))',
  'reservation requires exactly one Guide or Explorer invitation'
);
select is(
  (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conrelid = 'identity.auth_provider_provisioning_reservation'::regclass
       and conname = 'auth_provider_provisioning_reservation_provider_name_check'
  ),
  'CHECK ((provider_name = ''supabase''::text))',
  'reservation provider token is closed to supabase'
);
select is(
  (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conrelid = 'identity.auth_provider_provisioning_reservation'::regclass
       and conname = 'auth_provider_provisioning_reservation_horizon_check'
  ),
  'CHECK ((expires_at = (created_at + ''24:00:00''::interval)))',
  'reservation horizon is structurally fixed to 24 hours'
);
select is(
  (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conrelid = 'identity.auth_provider_provisioning_reservation'::regclass
       and conname = 'auth_provider_provisioning_reservation_retention_class_check'
  ),
  'CHECK ((retention_class = ''security_log''::text))',
  'reservation retention is structurally fixed to security_log'
);
select is(
  (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conrelid = 'identity.auth_provider_provisioning_reservation'::regclass
       and conname = 'auth_provider_provisioning_reservation_guide_invite_fk'
  ),
  'FOREIGN KEY (guide_invite_id) REFERENCES core.guide_invite(guide_invite_id) ON UPDATE RESTRICT ON DELETE RESTRICT',
  'Guide reservation FK is restrictive'
);
select is(
  (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conrelid = 'identity.auth_provider_provisioning_reservation'::regclass
       and conname = 'auth_provider_provisioning_reservation_explorer_invite_fk'
  ),
  'FOREIGN KEY (explorer_invite_id) REFERENCES core.explorer_invite(explorer_invite_id) ON UPDATE RESTRICT ON DELETE RESTRICT',
  'Explorer reservation FK is restrictive'
);
select is(
  (
    select pg_get_indexdef(indexrelid)
      from pg_index
     where indexrelid =
       'identity.auth_provider_provisioning_reservation_guide_invite_idx'::regclass
  ),
  'CREATE UNIQUE INDEX auth_provider_provisioning_reservation_guide_invite_idx ON identity.auth_provider_provisioning_reservation USING btree (guide_invite_id) WHERE (guide_invite_id IS NOT NULL)',
  'Guide invitation has one reservation structural backstop'
);
select is(
  (
    select pg_get_indexdef(indexrelid)
      from pg_index
     where indexrelid =
       'identity.auth_provider_provisioning_reservation_explorer_invite_idx'::regclass
  ),
  'CREATE UNIQUE INDEX auth_provider_provisioning_reservation_explorer_invite_idx ON identity.auth_provider_provisioning_reservation USING btree (explorer_invite_id) WHERE (explorer_invite_id IS NOT NULL)',
  'Explorer invitation has one reservation structural backstop'
);
select is(
  obj_description(
    'identity.auth_provider_provisioning_reservation'::regclass,
    'pg_class'
  ),
  'Immutable P27-B provider-correlation reservation. Its UUID is the protected provider correlation value. The 24-hour expires_at value marks an overdue reconciliation candidate only and never authorizes provider IO, acceptance, cleanup, or deletion.',
  'reservation comment preserves the non-authoritative horizon boundary'
);
select is(
  col_description(
    'identity.auth_provider_provisioning_reservation'::regclass,
    (
      select attnum
        from pg_attribute
       where attrelid =
         'identity.auth_provider_provisioning_reservation'::regclass
         and attname = 'expires_at'
         and not attisdropped
    )
  ),
  'Operational reconciliation horizon only. Expiry is not acceptance authority and does not authorize automatic cleanup.',
  'reservation expiry comment forbids automatic cleanup authority'
);

select has_column(
  'identity',
  'auth_provider_identity',
  'provisioning_reservation_id',
  'provider identity has nullable reservation correlation'
);
select col_is_null(
  'identity',
  'auth_provider_identity',
  'provisioning_reservation_id',
  'provider reservation correlation remains nullable for historical rows'
);
select is(
  (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conrelid = 'identity.auth_provider_identity'::regclass
       and conname = 'auth_provider_identity_provisioning_reservation_fk'
  ),
  'FOREIGN KEY (provisioning_reservation_id) REFERENCES identity.auth_provider_provisioning_reservation(provisioning_reservation_id) ON UPDATE RESTRICT ON DELETE RESTRICT',
  'provider reservation correlation FK is restrictive'
);
select is(
  (
    select pg_get_indexdef(indexrelid)
      from pg_index
     where indexrelid =
       'identity.auth_provider_identity_provisioning_reservation_idx'::regclass
  ),
  'CREATE UNIQUE INDEX auth_provider_identity_provisioning_reservation_idx ON identity.auth_provider_identity USING btree (provisioning_reservation_id) WHERE (provisioning_reservation_id IS NOT NULL)',
  'one reservation may bind at most one provider identity'
);
select is(
  (
    select pg_get_indexdef(indexrelid)
      from pg_index
     where indexrelid =
       'identity.auth_provider_identity_one_active_account_provider_idx'::regclass
  ),
  'CREATE UNIQUE INDEX auth_provider_identity_one_active_account_provider_idx ON identity.auth_provider_identity USING btree (user_account_id, provider_name) WHERE (status = ''active''::text)',
  'one active provider identity exists per account and provider'
);
select ok(
  not has_table_privilege(
    'service_role',
    'identity.auth_provider_identity',
    'UPDATE'
  ),
  'provider correlation hardening adds no direct service-role update'
);

select has_function(
  'public',
  'solmind_prepare_guide_invitation_acceptance',
  array['uuid','uuid','text'],
  'Guide preparation function exists'
);
select has_function(
  'public',
  'solmind_prepare_explorer_invitation_acceptance',
  array['uuid','uuid','text'],
  'Explorer preparation function exists'
);
select function_lang_is(
  'public',
  'solmind_prepare_guide_invitation_acceptance',
  array['uuid','uuid','text'],
  'plpgsql',
  'Guide preparation is plpgsql'
);
select function_lang_is(
  'public',
  'solmind_prepare_explorer_invitation_acceptance',
  array['uuid','uuid','text'],
  'plpgsql',
  'Explorer preparation is plpgsql'
);
select volatility_is(
  'public',
  'solmind_prepare_guide_invitation_acceptance',
  array['uuid','uuid','text'],
  'volatile',
  'Guide preparation is volatile'
);
select volatility_is(
  'public',
  'solmind_prepare_explorer_invitation_acceptance',
  array['uuid','uuid','text'],
  'volatile',
  'Explorer preparation is volatile'
);
select is(
  (
    select pg_get_function_result(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
  ),
  'TABLE(outcome text, provisioning_reservation_id uuid)',
  'Guide preparation returns exact bounded result'
);
select is(
  (
    select pg_get_function_result(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'TABLE(outcome text, provisioning_reservation_id uuid)',
  'Explorer preparation returns exact bounded result'
);
select ok(
  (
    select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
  ),
  'Guide preparation is security definer'
);
select ok(
  (
    select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'Explorer preparation is security definer'
);
select is(
  (
    select pg_get_userbyid(p.proowner)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
  ),
  'postgres',
  'Guide preparation owner is postgres'
);
select is(
  (
    select pg_get_userbyid(p.proowner)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'postgres',
  'Explorer preparation owner is postgres'
);
select is(
  (
    select p.proconfig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
  ),
  array['search_path=""','lock_timeout=2000ms']::text[],
  'Guide preparation pins search path and the effective per-lock timeout'
);
select is(
  (
    select p.proconfig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  array['search_path=""','lock_timeout=2000ms']::text[],
  'Explorer preparation pins search path and the effective per-lock timeout'
);
select is(
  (
    select count(*)::integer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
  ),
  1,
  'Guide preparation has no overload'
);
select is(
  (
    select count(*)::integer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  1,
  'Explorer preparation has no overload'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_prepare_guide_invitation_acceptance(uuid,uuid,text)',
    'EXECUTE'
  ),
  'service_role can execute Guide preparation'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_prepare_explorer_invitation_acceptance(uuid,uuid,text)',
    'EXECUTE'
  ),
  'service_role can execute Explorer preparation'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_prepare_guide_invitation_acceptance(uuid,uuid,text)',
    'EXECUTE'
  ),
  'anon cannot execute Guide preparation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_prepare_guide_invitation_acceptance(uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute Guide preparation'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_prepare_explorer_invitation_acceptance(uuid,uuid,text)',
    'EXECUTE'
  ),
  'anon cannot execute Explorer preparation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_prepare_explorer_invitation_acceptance(uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute Explorer preparation'
);
select ok(
  not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral pg_catalog.aclexplode(p.proacl) acl
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
       and acl.grantee = 0
       and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute Guide preparation'
);
select ok(
  not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral pg_catalog.aclexplode(p.proacl) acl
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
       and acl.grantee = 0
       and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute Explorer preparation'
);

select ok(
  (
    select p.prosrc like '%solmind:authorizing-evidence:v1|%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
  ),
  'Guide preparation uses the shared evidence lock first'
);
select ok(
  (
    select p.prosrc like '%solmind:authorizing-evidence:v1|%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'Explorer preparation uses the shared evidence lock first'
);
select ok(
  (
    select p.prosrc like '%array_agg(keys.lock_key order by keys.lock_key)%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
  ),
  'Guide preparation sorts and de-duplicates remaining domain locks'
);
select ok(
  (
    select p.prosrc like '%array_agg(keys.lock_key order by keys.lock_key)%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'Explorer preparation sorts and de-duplicates remaining domain locks'
);
select ok(
  (
    select
      strpos(p.prosrc, 'pg_advisory_xact_lock(v_evidence_lock_key)')
        < strpos(p.prosrc, 'foreach v_domain_lock_key in array v_domain_lock_keys')
      and strpos(p.prosrc, 'foreach v_domain_lock_key in array v_domain_lock_keys')
        < strpos(p.prosrc, 'select reservation.*')
      and strpos(p.prosrc, 'select reservation.*')
        < strpos(p.prosrc, 'perform invitation.guide_invite_id')
      and strpos(p.prosrc, 'perform invitation.guide_invite_id')
        < strpos(p.prosrc, 'select account.*')
      and strpos(p.prosrc, 'select account.*')
        < strpos(p.prosrc, 'perform contact.user_contact_method_id')
      and strpos(p.prosrc, 'perform contact.user_contact_method_id')
        < strpos(p.prosrc, 'perform provider_identity.auth_provider_identity_id')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
  ),
  'Guide preparation preserves evidence-domain-reservation-invite-account-contact-provider lock order'
);
select ok(
  (
    select
      strpos(p.prosrc, 'pg_advisory_xact_lock(v_evidence_lock_key)')
        < strpos(p.prosrc, 'foreach v_domain_lock_key in array v_domain_lock_keys')
      and strpos(p.prosrc, 'foreach v_domain_lock_key in array v_domain_lock_keys')
        < strpos(p.prosrc, 'select reservation.*')
      and strpos(p.prosrc, 'select reservation.*')
        < strpos(p.prosrc, 'perform invitation.explorer_invite_id')
      and strpos(p.prosrc, 'perform invitation.explorer_invite_id')
        < strpos(p.prosrc, 'select account.*')
      and strpos(p.prosrc, 'select account.*')
        < strpos(p.prosrc, 'perform contact.user_contact_method_id')
      and strpos(p.prosrc, 'perform contact.user_contact_method_id')
        < strpos(p.prosrc, 'perform provider_identity.auth_provider_identity_id')
      and strpos(p.prosrc, 'perform provider_identity.auth_provider_identity_id')
        < strpos(p.prosrc, 'from core.guide_profile guide_profile')
      and strpos(p.prosrc, 'from core.guide_profile guide_profile')
        < strpos(p.prosrc, 'from core.practice practice')
      and strpos(p.prosrc, 'from core.practice practice')
        < strpos(p.prosrc, 'from core.practice_guide practice_guide')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'Explorer preparation preserves evidence-domain-reservation-invite-account-contact-provider-Guide-Practice lock order'
);
select ok(
  (
    select p.prosrc like '%from core.practice_guide practice_guide%'
           and p.prosrc like '%practice_guide.relationship_status = ''active''%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'Explorer preparation requires the exact active Guide-Practice relationship'
);
select is(
  (
    select count(*)::integer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'solmind_prepare_guide_invitation_acceptance',
         'solmind_prepare_explorer_invitation_acceptance'
       )
       and obj_description(p.oid, 'pg_proc') like '%performs no provider IO%'
  ),
  2,
  'both preparation comments preserve the no-provider-IO boundary'
);
select ok(
  (
    select p.prosrc like '%solmind_invitation_prepare_policy_unavailable%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
  ),
  'Guide preparation carries fixed policy-unavailable error'
);
select ok(
  (
    select p.prosrc like '%solmind_invitation_prepare_evidence_consumed%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'Explorer preparation carries fixed evidence-consumed error'
);
select results_eq(
  $$select distinct ((matched.error_match)[1] collate "C") as error_name
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral regexp_matches(
        p.prosrc,
        'solmind_invitation_prepare_[a-z_]+',
        'g'
      ) matched(error_match)
     where n.nspname = 'public'
       and p.proname in (
         'solmind_prepare_guide_invitation_acceptance',
         'solmind_prepare_explorer_invitation_acceptance'
       )
     order by 1$$,
  $$select error_name collate "C" as error_name
      from (
        values
          ('solmind_invitation_prepare_conflict'::text),
          ('solmind_invitation_prepare_evidence_consumed'::text),
          ('solmind_invitation_prepare_ineligible'::text),
          ('solmind_invitation_prepare_integrity_failure'::text),
          ('solmind_invitation_prepare_invalid_request'::text),
          ('solmind_invitation_prepare_lock_unavailable'::text),
          ('solmind_invitation_prepare_policy_unavailable'::text),
          ('solmind_invitation_prepare_stale_evidence'::text)
      ) expected(error_name)
     order by error_name$$,
  'both preparation functions expose only the closed eight-class error vocabulary'
);
select ok(
  (
    select p.prosrc like '%auth_provider_provisioning_reserved%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
  ),
  'Guide preparation embeds exact reservation audit'
);
select ok(
  (
    select p.prosrc like '%auth_provider_provisioning_reserved%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'Explorer preparation embeds exact reservation audit'
);
select ok(
  (
    select p.prosrc not like '%solmind_record_audit_event%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
  ),
  'Guide preparation does not call the generic audit writer'
);
select ok(
  (
    select p.prosrc not like '%solmind_record_audit_event%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'Explorer preparation does not call the generic audit writer'
);
select ok(
  (
    select p.prosrc not like '%insert into identity.authorizing_evidence_consumption%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
  ),
  'Guide preparation does not consume authorizing evidence'
);
select ok(
  (
    select p.prosrc not like '%insert into identity.authorizing_evidence_consumption%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'Explorer preparation does not consume authorizing evidence'
);
select ok(
  (
    select p.prosrc not like '%update core.guide_invite%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_guide_invitation_acceptance'
  ),
  'Guide preparation does not mutate invitations'
);
select ok(
  (
    select p.prosrc not like '%update core.explorer_invite%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_explorer_invitation_acceptance'
  ),
  'Explorer preparation does not mutate invitations'
);

set local role anon;
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-0000-4000-8000-000000000001',
    'def50027-0000-4000-8000-000000000002',
    'denied@synthetic.invalid'
  )$$,
  '42501',
  'permission denied for function solmind_prepare_guide_invitation_acceptance',
  'anon direct Guide invocation is denied'
);
reset role;
set local role authenticated;
select throws_ok(
  $$select * from public.solmind_prepare_explorer_invitation_acceptance(
    'def50027-0000-4000-8000-000000000001',
    'def50027-0000-4000-8000-000000000002',
    'denied@synthetic.invalid'
  )$$,
  '42501',
  'permission denied for function solmind_prepare_explorer_invitation_acceptance',
  'authenticated direct Explorer invocation is denied'
);
reset role;
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    null,
    'def50027-0000-4000-8000-000000000002',
    'invalid@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_invalid_request',
  'service_role reaches Guide validation through the enumerated RPC'
);
select throws_ok(
  $$select * from public.solmind_prepare_explorer_invitation_acceptance(
    'def50027-0000-4000-8000-000000000001',
    null,
    'invalid@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_invalid_request',
  'service_role reaches Explorer validation through the enumerated RPC'
);
reset role;

select is(
  (
    select count(*)::integer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'solmind_prepare_guide_invitation_acceptance',
         'solmind_prepare_explorer_invitation_acceptance'
       )
       and strpos(p.prosrc, E'\n  begin\n') > 0
       and strpos(p.prosrc, E'\n  begin\n') < strpos(
         p.prosrc,
         case p.proname
           when 'solmind_prepare_guide_invitation_acceptance'
             then 'from core.guide_invite invitation'
           else 'from core.explorer_invite invitation'
         end
       )
  ),
  2,
  'both fixed-error guards begin before the first candidate table read'
);
select is(
  (
    select count(*)::integer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'solmind_prepare_guide_invitation_acceptance',
         'solmind_prepare_explorer_invitation_acceptance'
       )
       and p.prosrc like
         '%v_challenge.used_at < v_now - pg_catalog.make_interval(secs => v_active_seconds)%'
       and p.prosrc not like
         '%v_challenge.used_at <= v_now - pg_catalog.make_interval(secs => v_active_seconds)%'
  ),
  2,
  'both freshness checks accept exact equality and reject only values strictly outside the active boundary'
);

select ok(
  (
    select bool_and(c.relrowsecurity)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r','p')
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
  'every SolMind application table keeps RLS enabled'
);
select is(
  (
    select count(*)::integer
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
  'P27-B adds no policy to any SolMind application schema'
);

select * from finish();
rollback;
