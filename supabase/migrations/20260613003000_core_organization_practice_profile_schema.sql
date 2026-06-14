-- SolMind MVP0 core organization/practice/profile schema slice.
-- Source: execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md
-- Scope:
--   - core.organization
--   - core.practice
--   - core.guide_profile
--   - core.explorer_profile
--   - core.practice_guide
--   - core.guide_explorer_relationship
--
-- This migration intentionally creates no policies, grants, users, Admin seed data,
-- pilot data, invitation UI, onboarding UI, AI/chat/reflection tables, or storage buckets.

create schema if not exists core;

create table if not exists core.organization (
  organization_id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  description text null,
  is_self boolean not null default false,
  website_url text null,
  contact_email text null,
  contact_phone text null,
  address_line_1 text null,
  address_line_2 text null,
  city text null,
  region text null,
  postal_code text null,
  country text null,
  approval_status text not null default 'draft',
  approved_by_user_account_id uuid null references identity.user_account(user_account_id),
  approved_at timestamptz null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  created_by_user_account_id uuid null references identity.user_account(user_account_id),
  updated_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'core_business',

  constraint organization_name_not_blank_check
    check (length(trim(organization_name)) > 0),

  constraint organization_approval_status_check
    check (approval_status in ('draft', 'submitted', 'approved', 'changes_requested', 'rejected')),

  constraint organization_status_check
    check (status in ('active', 'inactive', 'deleted')),

  constraint organization_retention_class_check
    check (retention_class in ('core_business', 'sensitive_content', 'security_log', 'consent_legal')),

  constraint organization_approval_fields_check
    check (
      (approval_status = 'approved' and approved_at is not null)
      or
      (approval_status <> 'approved')
    )
);

alter table core.organization enable row level security;

create index if not exists organization_status_idx
  on core.organization (status);

create index if not exists organization_approval_status_idx
  on core.organization (approval_status);

create table if not exists core.practice (
  practice_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organization(organization_id),
  practice_name text not null,
  description text null,
  is_self boolean not null default false,
  same_as_organization boolean not null default false,
  website_url text null,
  contact_email text null,
  contact_phone text null,
  address_line_1 text null,
  address_line_2 text null,
  city text null,
  region text null,
  postal_code text null,
  country text null,
  approval_status text not null default 'draft',
  approved_by_user_account_id uuid null references identity.user_account(user_account_id),
  approved_at timestamptz null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  created_by_user_account_id uuid null references identity.user_account(user_account_id),
  updated_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'core_business',

  constraint practice_name_not_blank_check
    check (length(trim(practice_name)) > 0),

  constraint practice_approval_status_check
    check (approval_status in ('draft', 'submitted', 'approved', 'changes_requested', 'rejected')),

  constraint practice_status_check
    check (status in ('active', 'inactive', 'deleted')),

  constraint practice_retention_class_check
    check (retention_class in ('core_business', 'sensitive_content', 'security_log', 'consent_legal')),

  constraint practice_approval_fields_check
    check (
      (approval_status = 'approved' and approved_at is not null)
      or
      (approval_status <> 'approved')
    )
);

alter table core.practice enable row level security;

create index if not exists practice_organization_idx
  on core.practice (organization_id);

create index if not exists practice_status_idx
  on core.practice (status);

create index if not exists practice_approval_status_idx
  on core.practice (approval_status);

create table if not exists core.guide_profile (
  guide_profile_id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references identity.user_account(user_account_id),
  guide_display_name text not null,
  bio text null,
  style_notes text null,
  setup_status text not null default 'invite_pending',
  solmind_virtual_guide_name text null,
  solmind_guide_assistant_name text null,
  terminology_customization_enabled boolean not null default false,
  approved_by_user_account_id uuid null references identity.user_account(user_account_id),
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'core_business',

  constraint guide_profile_display_name_not_blank_check
    check (length(trim(guide_display_name)) > 0),

  constraint guide_profile_setup_status_check
    check (setup_status in ('invite_pending', 'profile_pending', 'submitted', 'approved', 'changes_requested', 'suspended')),

  constraint guide_profile_status_check
    check (status in ('active', 'inactive', 'deleted')),

  constraint guide_profile_retention_class_check
    check (retention_class in ('core_business', 'sensitive_content', 'security_log', 'consent_legal')),

  constraint guide_profile_approval_fields_check
    check (
      (setup_status = 'approved' and approved_at is not null)
      or
      (setup_status <> 'approved')
    )
);

alter table core.guide_profile enable row level security;

create unique index if not exists guide_profile_one_non_deleted_per_user_idx
  on core.guide_profile (user_account_id)
  where status <> 'deleted';

create index if not exists guide_profile_user_account_status_idx
  on core.guide_profile (user_account_id, status);

create index if not exists guide_profile_setup_status_idx
  on core.guide_profile (setup_status);

create table if not exists core.explorer_profile (
  explorer_profile_id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references identity.user_account(user_account_id),
  explorer_display_name text not null,
  onboarding_status text not null default 'invited',
  preferred_contact_channel text null,
  profile_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'core_business',

  constraint explorer_profile_display_name_not_blank_check
    check (length(trim(explorer_display_name)) > 0),

  constraint explorer_profile_onboarding_status_check
    check (onboarding_status in ('invited', 'contact_verified', 'consent_pending', 'intake_pending', 'active', 'paused', 'ended')),

  constraint explorer_profile_preferred_contact_channel_check
    check (preferred_contact_channel is null or preferred_contact_channel in ('email', 'sms', 'in_app')),

  constraint explorer_profile_status_check
    check (status in ('active', 'inactive', 'deleted')),

  constraint explorer_profile_retention_class_check
    check (retention_class in ('core_business', 'sensitive_content', 'security_log', 'consent_legal'))
);

alter table core.explorer_profile enable row level security;

create unique index if not exists explorer_profile_one_non_deleted_per_user_idx
  on core.explorer_profile (user_account_id)
  where status <> 'deleted';

create index if not exists explorer_profile_user_account_status_idx
  on core.explorer_profile (user_account_id, status);

create index if not exists explorer_profile_onboarding_status_idx
  on core.explorer_profile (onboarding_status);

create table if not exists core.practice_guide (
  practice_guide_id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references core.practice(practice_id),
  guide_profile_id uuid not null references core.guide_profile(guide_profile_id),
  relationship_status text not null default 'pending',
  is_primary_for_mvp0 boolean not null default false,
  created_at timestamptz not null default now(),
  created_by_user_account_id uuid null references identity.user_account(user_account_id),
  ended_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'core_business',

  constraint practice_guide_relationship_status_check
    check (relationship_status in ('pending', 'active', 'suspended', 'ended')),

  constraint practice_guide_retention_class_check
    check (retention_class in ('core_business', 'sensitive_content', 'security_log', 'consent_legal')),

  constraint practice_guide_ended_at_check
    check (
      (relationship_status = 'ended' and ended_at is not null)
      or
      (relationship_status <> 'ended')
    )
);

alter table core.practice_guide enable row level security;

create unique index if not exists practice_guide_one_active_pair_idx
  on core.practice_guide (practice_id, guide_profile_id)
  where relationship_status = 'active';

create unique index if not exists practice_guide_one_primary_for_mvp0_idx
  on core.practice_guide (guide_profile_id)
  where is_primary_for_mvp0 = true and relationship_status = 'active';

create index if not exists practice_guide_practice_status_idx
  on core.practice_guide (practice_id, relationship_status);

create index if not exists practice_guide_guide_status_idx
  on core.practice_guide (guide_profile_id, relationship_status);

create table if not exists core.guide_explorer_relationship (
  guide_explorer_relationship_id uuid primary key default gen_random_uuid(),
  guide_profile_id uuid not null references core.guide_profile(guide_profile_id),
  explorer_profile_id uuid not null references core.explorer_profile(explorer_profile_id),
  practice_id uuid not null references core.practice(practice_id),
  relationship_status text not null default 'invited',
  started_at timestamptz null,
  ended_at timestamptz null,
  created_from_invite_id uuid null,
  explorer_safe_guardrail text null,
  explorer_safe_guardrail_updated_at timestamptz null,
  explorer_safe_guardrail_updated_by_user_account_id uuid null references identity.user_account(user_account_id),
  created_at timestamptz not null default now(),
  created_by_user_account_id uuid null references identity.user_account(user_account_id),
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'core_business',

  constraint guide_explorer_relationship_status_check
    check (relationship_status in ('invited', 'intake_pending', 'active', 'paused', 'ended', 'transferred')),

  constraint guide_explorer_relationship_retention_class_check
    check (retention_class in ('core_business', 'sensitive_content', 'security_log', 'consent_legal')),

  constraint guide_explorer_relationship_started_at_check
    check (
      (relationship_status = 'active' and started_at is not null)
      or
      (relationship_status <> 'active')
    ),

  constraint guide_explorer_relationship_ended_at_check
    check (
      (relationship_status in ('ended', 'transferred') and ended_at is not null)
      or
      (relationship_status not in ('ended', 'transferred'))
    ),

  constraint guide_explorer_relationship_guardrail_length_check
    check (explorer_safe_guardrail is null or char_length(explorer_safe_guardrail) <= 2000),

  constraint guide_explorer_relationship_guardrail_update_fields_check
    check (
      (explorer_safe_guardrail is null and explorer_safe_guardrail_updated_at is null and explorer_safe_guardrail_updated_by_user_account_id is null)
      or
      (explorer_safe_guardrail is not null and explorer_safe_guardrail_updated_at is not null and explorer_safe_guardrail_updated_by_user_account_id is not null)
    )
);

alter table core.guide_explorer_relationship enable row level security;

create unique index if not exists guide_explorer_relationship_one_active_pair_idx
  on core.guide_explorer_relationship (guide_profile_id, explorer_profile_id)
  where relationship_status in ('invited', 'intake_pending', 'active', 'paused');

create index if not exists guide_explorer_relationship_guide_status_idx
  on core.guide_explorer_relationship (guide_profile_id, relationship_status);

create index if not exists guide_explorer_relationship_explorer_status_idx
  on core.guide_explorer_relationship (explorer_profile_id, relationship_status);

create index if not exists guide_explorer_relationship_practice_status_idx
  on core.guide_explorer_relationship (practice_id, relationship_status);

comment on table core.organization is 'Parent entity for a Guide, group, company, program, or self.';
comment on table core.practice is 'Practice, program, or reflective offering under an Organization.';
comment on table core.guide_profile is 'Guide-facing SolMind product profile linked to a user account.';
comment on table core.explorer_profile is 'Explorer-facing SolMind product profile linked to a user account.';
comment on table core.practice_guide is 'Many-to-many relationship between Practices and Guide profiles.';
comment on table core.guide_explorer_relationship is 'Relationship between a Guide and Explorer within a Practice.';

comment on column core.guide_explorer_relationship.created_from_invite_id is
  'Nullable future FK target to core.explorer_invite. Kept as uuid only in this slice because explorer_invite is intentionally out of scope.';

comment on column core.guide_explorer_relationship.explorer_safe_guardrail is
  'Explorer-safe, relationship-specific Guide-authored steering text. Must not contain private Guide notes, trigger labels, sensitive observations, or guide_only content.';
