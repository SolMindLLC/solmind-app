-- SolMind MVP0 AUD-1 pgTAP: audit writer dynamic hygiene, structural contract, and posture.
-- Source contract: execution/22_SolMind_MVP0_Auth_RLS_Audit_Persistence_Contract_v0_1.md (Section 12 families 1-2, 6).
-- Banked decision: AUTH-RLS-DEC-028.
-- Run with: supabase test db  (local stack only; never cloud).
--
-- Scope of THIS file (no fixtures required):
--   - dynamic pg_catalog hygiene for EVERY function in public matching solmind_%
--     (not a hard-coded list, so every future write function is automatically
--     covered and a missed re-grant after DROP+CREATE fails here): SECURITY
--     DEFINER, owner postgres, pinned empty search_path, EXECUTE granted to
--     service_role only with anon/authenticated denied - with a minimum-match-count
--     guard so the dynamic query can never pass vacuously;
--   - structural contract for public.solmind_record_audit_event: plpgsql, VOLATILE,
--     set-returning TABLE(audit_event_id uuid), the exact contracted parameter
--     list, and the structural absence of ip_address, user_agent, event_summary,
--     and timestamp parameters;
--   - privilege/posture probes: anon/authenticated hold no EXECUTE on the writer
--     and no SELECT on audit.audit_event; service_role holds no table privilege on
--     audit.audit_event and no privilege on the audit schema (owner bypass inside
--     the definer function is the ONLY write path); audit.audit_event keeps RLS
--     enabled and does NOT have FORCE ROW LEVEL SECURITY.
--
-- This file creates nothing permanent: it runs inside a transaction that ROLLS BACK,
-- seeds no data, adds no migration, no function, no policy, and no grant. The
-- behavioral positive-path, validation-negative, sentinel-non-leak, and
-- no-unintended-write coverage lives in audit_event_writer_realpath_test.sql.

begin;

select plan(27);

-- The dynamic match set: every function in public whose name starts with solmind_.
-- Temp table only; rolled back with the transaction.

create temp table solmind_public_functions as
select p.oid as fn_oid,
       p.proname,
       p.prosecdef,
       p.proconfig,
       pg_get_userbyid(p.proowner) as owner_name
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname like 'solmind\_%';

-- --- Dynamic hygiene across every public.solmind_ function -----------------------------------

select cmp_ok(
  (select count(*)::int from solmind_public_functions),
  '>=',
  7,
  'minimum-match-count guard: at least the seven known public.solmind_ functions exist (the dynamic hygiene sweep cannot pass vacuously)'
);

select ok(
  (select bool_and(prosecdef) from solmind_public_functions),
  'every public.solmind_ function is SECURITY DEFINER'
);

select ok(
  (select bool_and(
            exists (select 1 from unnest(coalesce(proconfig, array[]::text[])) as c
                     where c = 'search_path=""'))
     from solmind_public_functions),
  'every public.solmind_ function pins an empty search_path'
);

select ok(
  (select bool_and(owner_name = 'postgres') from solmind_public_functions),
  'every public.solmind_ function is owned by postgres'
);

select ok(
  (select bool_and(has_function_privilege('service_role', fn_oid, 'EXECUTE'))
     from solmind_public_functions),
  'service_role can EXECUTE every public.solmind_ function'
);

select ok(
  (select bool_or(has_function_privilege('anon', fn_oid, 'EXECUTE'))
     from solmind_public_functions) is not true,
  'anon cannot EXECUTE any public.solmind_ function'
);

select ok(
  (select bool_or(has_function_privilege('authenticated', fn_oid, 'EXECUTE'))
     from solmind_public_functions) is not true,
  'authenticated cannot EXECUTE any public.solmind_ function'
);

-- --- Structural contract for public.solmind_record_audit_event -------------------------------

select has_function(
  'public',
  'solmind_record_audit_event',
  array['text', 'text', 'text', 'uuid', 'text', 'uuid', 'text', 'jsonb'],
  'the audit writer exists with the exact contracted signature'
);

select is(
  (select provolatile::text from pg_proc
    where oid = 'public.solmind_record_audit_event(text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure),
  'v',
  'the audit writer is VOLATILE'
);

select is(
  (select l.lanname::text
     from pg_proc p
     join pg_language l on l.oid = p.prolang
    where p.oid = 'public.solmind_record_audit_event(text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure),
  'plpgsql',
  'the audit writer is LANGUAGE plpgsql'
);

select ok(
  (select proretset from pg_proc
    where oid = 'public.solmind_record_audit_event(text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure),
  'the audit writer is set-returning (matching the banked array transport contract)'
);

select is(
  pg_get_function_result('public.solmind_record_audit_event(text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure),
  'TABLE(audit_event_id uuid)',
  'the audit writer returns TABLE(audit_event_id uuid) and nothing else'
);

select is(
  pg_get_function_arguments('public.solmind_record_audit_event(text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure),
  'p_event_type text, p_action text, p_actor_role_context text, '
    || 'p_actor_user_account_id uuid DEFAULT NULL::uuid, '
    || 'p_target_entity_type text DEFAULT NULL::text, '
    || 'p_target_entity_id uuid DEFAULT NULL::uuid, '
    || 'p_reason_code text DEFAULT NULL::text, '
    || 'p_metadata jsonb DEFAULT ''{}''::jsonb',
  'the audit writer parameter names, types, and defaults match the contract exactly'
);

select ok(
  pg_get_function_arguments('public.solmind_record_audit_event(text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure)
    not like '%ip_address%',
  'no ip_address parameter exists (capture is structurally impossible for MVP0)'
);

select ok(
  pg_get_function_arguments('public.solmind_record_audit_event(text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure)
    not like '%user_agent%',
  'no user_agent parameter exists (capture is structurally impossible for MVP0)'
);

select ok(
  pg_get_function_arguments('public.solmind_record_audit_event(text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure)
    not like '%event_summary%',
  'no event_summary parameter exists (the summary is derived in-function, never caller-supplied)'
);

select ok(
  pg_get_function_arguments('public.solmind_record_audit_event(text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure)
    not like '%timestamp%',
  'no timestamp parameter exists (no backdating; created_at comes from the table default)'
);

-- --- Privilege/posture probes -----------------------------------------------------------------

select ok(
  not has_function_privilege('anon',
    'public.solmind_record_audit_event(text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure, 'EXECUTE'),
  'anon cannot EXECUTE the audit writer'
);

select ok(
  not has_function_privilege('authenticated',
    'public.solmind_record_audit_event(text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure, 'EXECUTE'),
  'authenticated cannot EXECUTE the audit writer'
);

select ok(
  has_function_privilege('service_role',
    'public.solmind_record_audit_event(text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure, 'EXECUTE'),
  'service_role can EXECUTE the audit writer (the sanctioned transport)'
);

select ok(
  not has_table_privilege('anon', 'audit.audit_event', 'SELECT'),
  'anon holds no SELECT on audit.audit_event'
);

select ok(
  not has_table_privilege('authenticated', 'audit.audit_event', 'SELECT'),
  'authenticated holds no SELECT on audit.audit_event'
);

select ok(
  (select bool_or(has_table_privilege('service_role', 'audit.audit_event', priv))
     from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as priv
  ) is not true,
  'service_role holds no direct table privilege on audit.audit_event (owner bypass inside the definer function is the only write path)'
);

select ok(
  not has_schema_privilege('service_role', 'audit', 'USAGE'),
  'service_role holds no USAGE on the audit schema'
);

select ok(
  not has_schema_privilege('service_role', 'audit', 'CREATE'),
  'service_role holds no CREATE on the audit schema'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'audit.audit_event'::regclass),
  'audit.audit_event keeps Row Level Security enabled (deny-by-default; zero policies)'
);

select ok(
  (select not relforcerowsecurity from pg_class where oid = 'audit.audit_event'::regclass),
  'audit.audit_event does not have FORCE ROW LEVEL SECURITY (forcing it would break the definer write path and requires a new AUTH-RLS decision first)'
);

select * from finish();

rollback;
