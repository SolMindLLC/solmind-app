-- SolMind MVP0 correction migration.
-- Purpose:
--   - add retention_class columns required by Data Model Spec §4.10
--   - relax verification_challenge.failed_attempt_count so invalidation logic can be handled safely in application code
--
-- This migration intentionally creates no users, policies, grants, or real pilot data.

do $$
declare
  retention_target record;
begin
  for retention_target in
    select * from (values
      ('identity', 'role_type', 'core_business'),
      ('identity', 'user_account', 'core_business'),
      ('identity', 'user_role_assignment', 'core_business'),
      ('identity', 'user_contact_method', 'core_business'),
      ('identity', 'auth_provider_identity', 'core_business'),
      ('identity', 'verification_challenge', 'security_log'),
      ('identity', 'login_attempt', 'security_log'),
      ('identity', 'user_session', 'security_log'),
      ('audit', 'audit_event', 'security_log')
    ) as retention_values(schema_name, table_name, retention_class)
  loop
    execute format(
      'alter table %I.%I add column if not exists retention_class text not null default %L',
      retention_target.schema_name,
      retention_target.table_name,
      retention_target.retention_class
    );

    execute format(
      'alter table %I.%I drop constraint if exists %I',
      retention_target.schema_name,
      retention_target.table_name,
      retention_target.table_name || '_retention_class_check'
    );

    execute format(
      'alter table %I.%I add constraint %I check (retention_class in (''core_business'', ''sensitive_content'', ''security_log'', ''consent_legal''))',
      retention_target.schema_name,
      retention_target.table_name,
      retention_target.table_name || '_retention_class_check'
    );
  end loop;
end $$;

alter table identity.verification_challenge
  drop constraint if exists verification_challenge_failed_attempt_count_check;

alter table identity.verification_challenge
  add constraint verification_challenge_failed_attempt_count_check
  check (failed_attempt_count >= 0);
