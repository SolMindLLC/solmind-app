begin;
select plan(34);

select has_column(
  'ai',
  'ai_context_snapshot',
  'authorization_version',
  'context snapshot has an explicit authorization version'
);
select has_column(
  'ai',
  'ai_context_snapshot',
  'active_required_consent_document_ids',
  'context snapshot pins the current required consent set'
);
select has_column(
  'ai',
  'ai_context_snapshot',
  'context_source_ids',
  'context snapshot pins bounded source identities without source content'
);
select has_column(
  'ai',
  'ai_context_snapshot',
  'context_fingerprint_sha256',
  'context snapshot pins the exact authorized-context fingerprint'
);
select has_column(
  'ai',
  'ai_model_invocation',
  'logical_operation_id',
  'model invocation owns one logical dispatch identity'
);
select has_column(
  'ai',
  'ai_model_invocation',
  'ai_context_snapshot_id',
  'model invocation binds the exact context snapshot'
);
select col_is_fk(
  'ai',
  'ai_model_invocation',
  'ai_context_snapshot_id',
  'invocation context-snapshot binding is a foreign key'
);
select ok(
  (
    select c.relrowsecurity and not c.relforcerowsecurity
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'ai'
       and c.relname = 'ai_context_snapshot'
  ),
  'context-snapshot RLS remains enabled and not forced'
);
select ok(
  (
    select c.relrowsecurity and not c.relforcerowsecurity
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'ai'
       and c.relname = 'ai_model_invocation'
  ),
  'model-invocation RLS remains enabled and not forced'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_policies
     where schemaname = 'ai'
       and tablename in ('ai_context_snapshot', 'ai_model_invocation')
  ),
  0,
  'the two protected evidence tables retain zero RLS policies'
);
select ok(
  not has_table_privilege(
    'service_role',
    'ai.ai_context_snapshot',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'service_role has no direct context-snapshot table access'
);
select ok(
  not has_table_privilege(
    'service_role',
    'ai.ai_model_invocation',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'service_role has no direct model-invocation table access'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'ai.ai_context_snapshot',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'authenticated has no direct context-snapshot table access'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'ai.ai_model_invocation',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'authenticated has no direct model-invocation table access'
);
select ok(
  not has_table_privilege(
    'anon',
    'ai.ai_context_snapshot',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'anon has no direct context-snapshot table access'
);
select ok(
  not has_table_privilege(
    'anon',
    'ai.ai_model_invocation',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'anon has no direct model-invocation table access'
);

select has_function(
  'public',
  'solmind_prepare_virtual_guide_predispatch',
  array[
    'uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'uuid',
    'text', 'uuid[]', 'uuid[]', 'text'
  ],
  'one exact Virtual Guide pre-dispatch transaction exists'
);
select volatility_is(
  'public',
  'solmind_prepare_virtual_guide_predispatch',
  array[
    'uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'uuid',
    'text', 'uuid[]', 'uuid[]', 'text'
  ],
  'volatile',
  'pre-dispatch transaction is volatile'
);
select ok(
  (
    select p.prosecdef
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_virtual_guide_predispatch'
  ),
  'pre-dispatch transaction is security definer'
);
select is(
  (
    select pg_catalog.pg_get_userbyid(p.proowner)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_virtual_guide_predispatch'
  ),
  'postgres',
  'pre-dispatch transaction owner is postgres'
);
select ok(
  (
    select 'search_path=""' = any(p.proconfig)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_virtual_guide_predispatch'
  ),
  'pre-dispatch transaction has an empty search path'
);
select ok(
  (
    select 'lock_timeout=2000ms' = any(p.proconfig)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_virtual_guide_predispatch'
  ),
  'pre-dispatch transaction has a bounded lock timeout'
);
select ok(
  (
    select p.prosrc like '%for share of account, assignment%'
       and p.prosrc like '%lock table core.consent_document in share mode%'
       and p.prosrc like '%for share of record%'
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_virtual_guide_predispatch'
  ),
  'pre-dispatch transaction locks authority rows and stabilizes consent scope'
);
select ok(
  (
    select p.prosrc like '%v_session.session_type not in (%'
       and p.prosrc like '%v_session.practice_id is distinct from%'
       and p.prosrc like '%v_practice.status <> ''active''%'
       and p.prosrc like '%v_practice.approval_status <> ''approved''%'
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_virtual_guide_predispatch'
  ),
  'pre-dispatch transaction pins Explorer session and Practice eligibility'
);
select is(
  (
    select pg_catalog.pg_get_function_result(p.oid)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_prepare_virtual_guide_predispatch'
  ),
  'TABLE(preparation_state text, prepared_context_snapshot_id uuid, prepared_model_invocation_id uuid)',
  'pre-dispatch return shape is exact'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_prepare_virtual_guide_predispatch(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid[],uuid[],text)',
    'EXECUTE'
  ),
  'service_role may execute the pre-dispatch transaction'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_prepare_virtual_guide_predispatch(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid[],uuid[],text)',
    'EXECUTE'
  ),
  'authenticated may not execute the pre-dispatch transaction'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_prepare_virtual_guide_predispatch(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid[],uuid[],text)',
    'EXECUTE'
  ),
  'anon may not execute the pre-dispatch transaction'
);
select ok(
  not has_function_privilege(
    'public',
    'public.solmind_prepare_virtual_guide_predispatch(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid[],uuid[],text)',
    'EXECUTE'
  ),
  'PUBLIC may not execute the pre-dispatch transaction'
);
select index_is_unique(
  'ai',
  'ai_model_invocation',
  'ai_model_invocation_logical_operation_unique_idx',
  'logical operation identity is unique'
);
select index_is_unique(
  'ai',
  'ai_model_invocation',
  'ai_model_invocation_context_snapshot_unique_idx',
  'one context snapshot can bind only one invocation'
);
select ok(
  pg_catalog.obj_description(
    'public.solmind_prepare_virtual_guide_predispatch(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid[],uuid[],text)'::regprocedure,
    'pg_proc'
  ) like '%Exact retry returns exact_retry and must never authorize a second provider call%',
  'function contract visibly forbids a second provider call on exact retry'
);
select ok(
  pg_catalog.col_description(
    'ai.ai_context_snapshot'::regclass,
    (
      select a.attnum
        from pg_catalog.pg_attribute a
       where a.attrelid = 'ai.ai_context_snapshot'::regclass
         and a.attname = 'context_fingerprint_sha256'
    )
  ) like '%never copy it into audit metadata%',
  'fingerprint comment preserves the audit privacy boundary'
);
select ok(
  pg_catalog.col_description(
    'ai.ai_model_invocation'::regclass,
    (
      select a.attnum
        from pg_catalog.pg_attribute a
       where a.attrelid = 'ai.ai_model_invocation'::regclass
         and a.attname = 'logical_operation_id'
    )
  ) like '%idempotency owner%',
  'logical operation comment states its idempotency ownership'
);

select * from finish();
rollback;
