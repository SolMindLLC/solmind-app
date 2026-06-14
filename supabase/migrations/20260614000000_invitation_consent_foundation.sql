-- SolMind MVP0 invitation and consent foundation.
-- Purpose:
--   - add Admin-to-Guide and Guide-to-Explorer invitation records
--   - connect guide_explorer_relationship.created_from_invite_id to explorer_invite
--   - add versioned consent document and consent acceptance records
--
-- This migration intentionally creates no users, no policies, no grants,
-- no real pilot data, no active consent seed data, no UI, and no notification delivery tables.

create table if not exists core.guide_invite (
  guide_invite_id uuid primary key default gen_random_uuid(),
  invited_contact_value text not null,
  normalized_contact_value text not null,
  contact_method_type text not null,
  invited_name text null,
  invited_by_user_account_id uuid not null references identity.user_account(user_account_id),
  invite_status text not null default 'created',
  expires_at timestamptz not null,
  accepted_by_user_account_id uuid null references identity.user_account(user_account_id),
  accepted_at timestamptz null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  revoked_at timestamptz null,
  failed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'core_business',

  constraint guide_invite_contact_method_type_check
    check (contact_method_type in ('email', 'phone')),

  constraint guide_invite_status_check
    check (invite_status in ('created', 'sent', 'accepted', 'expired', 'revoked', 'failed')),

  constraint guide_invite_contact_not_blank_check
    check (length(trim(invited_contact_value)) > 0 and length(trim(normalized_contact_value)) > 0),

  constraint guide_invite_invited_name_not_blank_check
    check (invited_name is null or length(trim(invited_name)) > 0),

  constraint guide_invite_retention_class_check
    check (retention_class in ('core_business', 'sensitive_content', 'security_log', 'consent_legal')),

  constraint guide_invite_acceptance_fields_check
    check (
      (invite_status = 'accepted' and accepted_by_user_account_id is not null and accepted_at is not null)
      or
      (invite_status <> 'accepted')
    ),

  constraint guide_invite_sent_fields_check
    check (
      (invite_status = 'sent' and sent_at is not null)
      or
      (invite_status <> 'sent')
    ),

  constraint guide_invite_revoked_fields_check
    check (
      (invite_status = 'revoked' and revoked_at is not null)
      or
      (invite_status <> 'revoked')
    ),

  constraint guide_invite_failed_fields_check
    check (
      (invite_status = 'failed' and failed_at is not null)
      or
      (invite_status <> 'failed')
    )
);

alter table core.guide_invite enable row level security;

create index if not exists guide_invite_status_expires_idx
  on core.guide_invite (invite_status, expires_at);

create index if not exists guide_invite_invited_by_status_idx
  on core.guide_invite (invited_by_user_account_id, invite_status);

create index if not exists guide_invite_normalized_contact_idx
  on core.guide_invite (contact_method_type, normalized_contact_value, invite_status);

create table if not exists core.explorer_invite (
  explorer_invite_id uuid primary key default gen_random_uuid(),
  guide_profile_id uuid not null references core.guide_profile(guide_profile_id),
  practice_id uuid not null references core.practice(practice_id),
  invited_contact_value text not null,
  normalized_contact_value text not null,
  contact_method_type text not null,
  invited_name text null,
  invite_status text not null default 'created',
  expires_at timestamptz not null,
  accepted_by_user_account_id uuid null references identity.user_account(user_account_id),
  accepted_at timestamptz null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  revoked_at timestamptz null,
  failed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'core_business',

  constraint explorer_invite_contact_method_type_check
    check (contact_method_type in ('email', 'phone')),

  constraint explorer_invite_status_check
    check (invite_status in ('created', 'sent', 'accepted', 'expired', 'revoked', 'failed')),

  constraint explorer_invite_contact_not_blank_check
    check (length(trim(invited_contact_value)) > 0 and length(trim(normalized_contact_value)) > 0),

  constraint explorer_invite_invited_name_not_blank_check
    check (invited_name is null or length(trim(invited_name)) > 0),

  constraint explorer_invite_retention_class_check
    check (retention_class in ('core_business', 'sensitive_content', 'security_log', 'consent_legal')),

  constraint explorer_invite_acceptance_fields_check
    check (
      (invite_status = 'accepted' and accepted_by_user_account_id is not null and accepted_at is not null)
      or
      (invite_status <> 'accepted')
    ),

  constraint explorer_invite_sent_fields_check
    check (
      (invite_status = 'sent' and sent_at is not null)
      or
      (invite_status <> 'sent')
    ),

  constraint explorer_invite_revoked_fields_check
    check (
      (invite_status = 'revoked' and revoked_at is not null)
      or
      (invite_status <> 'revoked')
    ),

  constraint explorer_invite_failed_fields_check
    check (
      (invite_status = 'failed' and failed_at is not null)
      or
      (invite_status <> 'failed')
    )
);

alter table core.explorer_invite enable row level security;

create index if not exists explorer_invite_guide_status_idx
  on core.explorer_invite (guide_profile_id, invite_status);

create index if not exists explorer_invite_practice_status_idx
  on core.explorer_invite (practice_id, invite_status);

create index if not exists explorer_invite_status_expires_idx
  on core.explorer_invite (invite_status, expires_at);

create index if not exists explorer_invite_normalized_contact_idx
  on core.explorer_invite (contact_method_type, normalized_contact_value, invite_status);

create table if not exists core.consent_document (
  consent_document_id uuid primary key default gen_random_uuid(),
  consent_type text not null,
  version_number integer not null,
  version_label text not null,
  title text not null,
  body_markdown text not null,
  document_status text not null default 'draft',
  is_required_for_explorer boolean not null default false,
  is_required_for_guide boolean not null default false,
  effective_at timestamptz null,
  retired_at timestamptz null,
  previous_consent_document_id uuid null references core.consent_document(consent_document_id),
  created_at timestamptz not null default now(),
  created_by_user_account_id uuid not null references identity.user_account(user_account_id),
  created_by_role_context text not null default 'admin',
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'consent_legal',

  constraint consent_document_type_check
    check (consent_type in ('user_agreement', 'privacy_policy', 'ai_disclosure', 'admin_visibility', 'crisis_limitation')),

  constraint consent_document_version_number_check
    check (version_number > 0),

  constraint consent_document_text_not_blank_check
    check (
      length(trim(version_label)) > 0
      and length(trim(title)) > 0
      and length(trim(body_markdown)) > 0
    ),

  constraint consent_document_status_check
    check (document_status in ('draft', 'active', 'superseded', 'retired')),

  constraint consent_document_created_by_role_context_check
    check (created_by_role_context = 'admin'),

  constraint consent_document_retention_class_check
    check (retention_class = 'consent_legal'),

  constraint consent_document_active_effective_at_check
    check (
      (document_status = 'active' and effective_at is not null)
      or
      (document_status <> 'active')
    ),

  constraint consent_document_retired_at_check
    check (
      (document_status in ('superseded', 'retired') and retired_at is not null)
      or
      (document_status not in ('superseded', 'retired'))
    )
);

alter table core.consent_document enable row level security;

create unique index if not exists consent_document_type_version_unique_idx
  on core.consent_document (consent_type, version_number);

create unique index if not exists consent_document_one_active_type_idx
  on core.consent_document (consent_type)
  where document_status = 'active';

create index if not exists consent_document_type_status_idx
  on core.consent_document (consent_type, document_status);

create table if not exists core.consent_record (
  consent_record_id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references identity.user_account(user_account_id),
  role_context text not null,
  consent_type text not null,
  document_version text not null,
  consent_document_id uuid not null references core.consent_document(consent_document_id),
  adult_affirmation boolean null,
  accepted_at timestamptz not null default now(),
  acceptance_metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'consent_legal',

  constraint consent_record_role_context_check
    check (role_context in ('admin', 'guide', 'explorer')),

  constraint consent_record_type_check
    check (consent_type in ('user_agreement', 'privacy_policy', 'ai_disclosure', 'admin_visibility', 'crisis_limitation')),

  constraint consent_record_document_version_not_blank_check
    check (length(trim(document_version)) > 0),

  constraint consent_record_retention_class_check
    check (retention_class = 'consent_legal')
);

alter table core.consent_record enable row level security;

create index if not exists consent_record_user_type_accepted_idx
  on core.consent_record (user_account_id, consent_type, accepted_at desc);

create index if not exists consent_record_document_idx
  on core.consent_record (consent_document_id);

create index if not exists consent_record_user_document_idx
  on core.consent_record (user_account_id, consent_document_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'guide_explorer_relationship_created_from_invite_fk'
  ) then
    alter table core.guide_explorer_relationship
      add constraint guide_explorer_relationship_created_from_invite_fk
      foreign key (created_from_invite_id)
      references core.explorer_invite(explorer_invite_id);
  end if;
end $$;

create index if not exists guide_explorer_relationship_created_from_invite_idx
  on core.guide_explorer_relationship (created_from_invite_id)
  where created_from_invite_id is not null;

comment on table core.guide_invite is 'Admin-created invitation for a Guide to join SolMind MVP0.';
comment on table core.explorer_invite is 'Guide-created invitation for an Explorer within a Practice context.';
comment on table core.consent_document is 'Versioned immutable consent, privacy, AI disclosure, admin visibility, and crisis limitation document text.';
comment on table core.consent_record is 'Immutable record of a user accepting a specific consent document version.';

comment on column core.guide_explorer_relationship.created_from_invite_id is
  'Nullable FK to core.explorer_invite for relationships created from an accepted Explorer invitation.';
