-- INITIAL, UNEXECUTED proof setup, not a migration or shared demo seed.
-- Root only: inspected disposable local stack API 127.0.0.1:55321.
-- Derives the f420 UUID family and minimum application rows from the rollback
-- fixture solmind-app/supabase/tests/explorer_conversation_composition_test.sql.
-- Intentionally COMMITTED synthetic fixtures, four provider mappings, current
-- sessions and one already-revoked session. Creates NO Auth users/passwords,
-- tables, functions, policies or grants. The opt-in test creates four local Auth
-- users with precisely the provider UUIDs predeclared below; never shared users.
-- Root must verify actual target ownership/ports/idle state BEFORE this file.
-- Required same-connection setting (not a substitute for target verification):
-- set solmind.explorer_local_proof = 'EXPLORER_CONVERSATION_ISOLATED_55321_SYNTHETIC_TRANSPORT_ONLY_V1';
begin;
do $$ begin
  if current_database() <> 'postgres' or current_user <> 'postgres'
    or current_setting('solmind.explorer_local_proof', true) is distinct from
      'EXPLORER_CONVERSATION_ISOLATED_55321_SYNTHETIC_TRANSPORT_ONLY_V1'
  then raise exception 'explorer_local_proof_target_guard_failed'; end if;
  if exists(select 1 from identity.user_account)
    or exists(select 1 from auth.users)
    or exists(select 1 from identity.auth_provider_identity)
    or exists(select 1 from core.consent_document
      where document_status='active' and is_required_for_explorer is true)
    or exists(select 1 from ai.explorer_conversation_state)
  then raise exception 'explorer_local_proof_requires_empty_disposable_fixture_state'; end if;
end $$;

insert into identity.user_account(user_account_id,display_name,account_status) values
  ('f4200000-0000-4000-8000-000000000001','Synthetic Composition Explorer','active'),
  ('f4200000-0000-4000-8000-000000000002','Synthetic Composition Guide','active'),
  ('f4200000-0000-4000-8000-000000000003','Synthetic Composition Admin','active'),
  ('f4200000-0000-4000-8000-000000000004','Synthetic Other Explorer','active');
insert into identity.user_role_assignment(user_role_assignment_id,user_account_id,role_code,role_status) values
  ('f4200000-0000-4000-8000-000000000011','f4200000-0000-4000-8000-000000000001','explorer','active'),
  ('f4200000-0000-4000-8000-000000000012','f4200000-0000-4000-8000-000000000002','guide','active'),
  ('f4200000-0000-4000-8000-000000000013','f4200000-0000-4000-8000-000000000003','admin','active'),
  ('f4200000-0000-4000-8000-000000000014','f4200000-0000-4000-8000-000000000004','explorer','active');
insert into identity.auth_provider_identity(auth_provider_identity_id,user_account_id,provider_name,provider_user_id,provider_email,status) values
  ('f4200000-0000-4000-8000-000000000211','f4200000-0000-4000-8000-000000000001','supabase','f4200000-0000-4000-8000-000000000201','explorer-conversation-proof-20261024@example.invalid','active'),
  ('f4200000-0000-4000-8000-000000000212','f4200000-0000-4000-8000-000000000004','supabase','f4200000-0000-4000-8000-000000000202','other-explorer-conversation-proof-20261024@example.invalid','active'),
  ('f4200000-0000-4000-8000-000000000213','f4200000-0000-4000-8000-000000000002','supabase','f4200000-0000-4000-8000-000000000203','guide-conversation-proof-20261024@example.invalid','active'),
  ('f4200000-0000-4000-8000-000000000214','f4200000-0000-4000-8000-000000000003','supabase','f4200000-0000-4000-8000-000000000204','admin-conversation-proof-20261024@example.invalid','active');
insert into core.organization(organization_id,organization_name,approval_status,approved_by_user_account_id,approved_at)
  values('f4200000-0000-4000-8000-000000000021','Synthetic Composition Organization','approved','f4200000-0000-4000-8000-000000000003',now());
insert into core.practice(practice_id,organization_id,practice_name,approval_status,approved_by_user_account_id,approved_at)
  values('f4200000-0000-4000-8000-000000000022','f4200000-0000-4000-8000-000000000021','Synthetic Composition Practice','approved','f4200000-0000-4000-8000-000000000003',now());
insert into core.guide_profile(guide_profile_id,user_account_id,guide_display_name,setup_status,approved_by_user_account_id,approved_at,status)
  values('f4200000-0000-4000-8000-000000000023','f4200000-0000-4000-8000-000000000002','Synthetic Guide Private Canary','approved','f4200000-0000-4000-8000-000000000003',now(),'active');
insert into core.explorer_profile(explorer_profile_id,user_account_id,explorer_display_name,onboarding_status,status) values
  ('f4200000-0000-4000-8000-000000000024','f4200000-0000-4000-8000-000000000001','Synthetic Composition Explorer','active','active'),
  ('f4200000-0000-4000-8000-000000000026','f4200000-0000-4000-8000-000000000004','Synthetic Other Explorer','active','active');
insert into core.guide_explorer_relationship(guide_explorer_relationship_id,guide_profile_id,explorer_profile_id,practice_id,relationship_status,started_at) values
  ('f4200000-0000-4000-8000-000000000025','f4200000-0000-4000-8000-000000000023','f4200000-0000-4000-8000-000000000024','f4200000-0000-4000-8000-000000000022','active',now()),
  ('f4200000-0000-4000-8000-000000000027','f4200000-0000-4000-8000-000000000023','f4200000-0000-4000-8000-000000000026','f4200000-0000-4000-8000-000000000022','active',now());
insert into core.consent_document(consent_document_id,consent_type,version_number,version_label,title,body_markdown,
  document_status,is_required_for_explorer,effective_at,created_by_user_account_id) values
  ('f4200000-0000-4000-8000-000000000031','user_agreement',9420,'synthetic-composition-9420','Synthetic Agreement','Local fixture only.','active',true,now(),'f4200000-0000-4000-8000-000000000003'),
  ('f4200000-0000-4000-8000-000000000032','ai_disclosure',9420,'synthetic-composition-9420','Synthetic AI Disclosure','Local fixture only.','active',true,now(),'f4200000-0000-4000-8000-000000000003');
insert into core.consent_record(consent_record_id,user_account_id,role_context,consent_type,document_version,consent_document_id,adult_affirmation) values
  ('f4200000-0000-4000-8000-000000000041','f4200000-0000-4000-8000-000000000001','explorer','user_agreement','synthetic-composition-9420','f4200000-0000-4000-8000-000000000031',true),
  ('f4200000-0000-4000-8000-000000000042','f4200000-0000-4000-8000-000000000001','explorer','ai_disclosure','synthetic-composition-9420','f4200000-0000-4000-8000-000000000032',true),
  ('f4200000-0000-4000-8000-000000000043','f4200000-0000-4000-8000-000000000004','explorer','user_agreement','synthetic-composition-9420','f4200000-0000-4000-8000-000000000031',true),
  ('f4200000-0000-4000-8000-000000000044','f4200000-0000-4000-8000-000000000004','explorer','ai_disclosure','synthetic-composition-9420','f4200000-0000-4000-8000-000000000032',true);
insert into identity.user_session(user_session_id,user_account_id,active_role_context,created_at,expires_at,session_status) values
  ('f4200000-0000-4000-8000-000000000050','f4200000-0000-4000-8000-000000000001','explorer',now()-interval '1 minute',now()+interval '40 minutes','active'),
  ('f4200000-0000-4000-8000-000000000054','f4200000-0000-4000-8000-000000000004','explorer',now()-interval '1 minute',now()+interval '40 minutes','active'),
  ('f4200000-0000-4000-8000-000000000056','f4200000-0000-4000-8000-000000000002','guide',now()-interval '1 minute',now()+interval '40 minutes','active'),
  ('f4200000-0000-4000-8000-000000000057','f4200000-0000-4000-8000-000000000003','admin',now()-interval '1 minute',now()+interval '40 minutes','active');
insert into identity.user_session(user_session_id,user_account_id,active_role_context,created_at,expires_at,ended_at,session_status) values
  ('f4200000-0000-4000-8000-000000000058','f4200000-0000-4000-8000-000000000001','explorer',now()-interval '4 minutes',now()+interval '40 minutes',now()-interval '3 minutes','revoked');
insert into core.intake_response_set(intake_response_set_id,guide_explorer_relationship_id,started_at,completed_at,intake_status,response_json) values
  ('f4200000-0000-4000-8000-000000000052','f4200000-0000-4000-8000-000000000025',now()-interval '1 hour',now(),'completed',
    '{"supportNow":"Synthetic support source","usefulOutcome":"Synthetic useful outcome","supportStyle":"Synthetic style","guideContext":"Synthetic shared answer","communicationPreference":"Synthetic preference","doNotEmphasize":"Synthetic excluded topic"}'),
  ('f4200000-0000-4000-8000-000000000055','f4200000-0000-4000-8000-000000000027',now()-interval '1 hour',now(),'completed',
    '{"supportNow":"Synthetic other support","usefulOutcome":"Synthetic other outcome","supportStyle":"Synthetic other style"}');
commit;
