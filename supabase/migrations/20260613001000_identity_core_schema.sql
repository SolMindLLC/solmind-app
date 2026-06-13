-- SolMind MVP0 identity/core schema foundation.
-- Source: execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md
-- Scope:
--   - create initial application schemas
--   - create identity and audit foundation tables
--   - seed only stable role reference values
--   - enable RLS on every SolMind application table
--   - create no permissive RLS policies
--   - create no Admin user or real pilot data

create extension if not exists pgcrypto;

create schema if not exists identity;
create schema if not exists core;
create schema if not exists audit;

create table if not exists identity.role_type (
  role_code text primary key,
  role_label text not null,
  description text null,
  created_at timestamptz not null default now(),

  constraint role_type_role_code_check
    check (role_code in ('admin', 'guide', 'explorer'))
);

alter table identity.role_type enable row level security;

insert into identity.role_type (role_code, role_label, description)
values
  ('admin', 'Admin', 'Operational super-user in MVP0.'),
  ('guide', 'Guide', 'Human reflective support figure.'),
  ('explorer', 'Explorer', 'Person receiving reflective support.')
on conflict (role_code) do update
set
  role_label = excluded.role_label,
  description = excluded.description;

create table if not exists identity.user_account (
  user_account_id uuid primary key default gen_random_uuid(),
  display_name text not null,
  first_name text null,
  last_name text null,
  username text null,
  account_status text not null default 'pending',
  created_at timestamptz not null default now(),
  created_by_user_account_id uuid null references identity.user_account(user_account_id),
  last_login_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,

  constraint user_account_account_status_check
    check (account_status in ('pending', 'active', 'suspended', 'locked', 'inactive', 'deleted')),

  constraint user_account_username_not_blank_check
    check (username is null or length(trim(username)) > 0)
);

alter table identity.user_account enable row level security;

create unique index if not exists user_account_username_unique_idx
  on identity.user_account (lower(username))
  where username is not null and account_status <> 'deleted';

create table if not exists identity.user_role_assignment (
  user_role_assignment_id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references identity.user_account(user_account_id),
  role_code text not null references identity.role_type(role_code),
  role_status text not null default 'pending',
  granted_by_user_account_id uuid null references identity.user_account(user_account_id),
  granted_by_role_context text null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,

  constraint user_role_assignment_role_status_check
    check (role_status in ('pending', 'active', 'suspended', 'revoked')),

  constraint user_role_assignment_granted_by_role_context_check
    check (granted_by_role_context is null or granted_by_role_context in ('admin', 'guide', 'explorer', 'system'))
);

alter table identity.user_role_assignment enable row level security;

create unique index if not exists user_role_assignment_one_active_role_idx
  on identity.user_role_assignment (user_account_id, role_code)
  where role_status = 'active';

create index if not exists user_role_assignment_user_account_idx
  on identity.user_role_assignment (user_account_id, role_status);

create table if not exists identity.user_contact_method (
  user_contact_method_id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references identity.user_account(user_account_id),
  contact_method_type text not null,
  contact_label text not null,
  contact_value text not null,
  normalized_contact_value text not null,
  phone_type text null,
  sms_capable boolean null,
  login_enabled boolean not null default false,
  is_verified boolean not null default false,
  verified_at timestamptz null,
  verification_method text null,
  masked_display text null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint user_contact_method_type_check
    check (contact_method_type in ('email', 'phone')),

  constraint user_contact_method_label_check
    check (contact_label in ('primary', 'alternate')),

  constraint user_contact_method_phone_type_check
    check (phone_type is null or phone_type in ('home', 'work', 'wireless', 'other')),

  constraint user_contact_method_status_check
    check (status in ('pending', 'active', 'replaced', 'disabled', 'deleted')),

  constraint user_contact_method_phone_fields_check
    check (
      (contact_method_type = 'phone' and phone_type is not null and sms_capable is not null)
      or
      (contact_method_type = 'email' and phone_type is null and sms_capable is null)
    ),

  constraint user_contact_method_login_requires_verified_active_check
    check (
      login_enabled = false
      or
      (is_verified = true and status = 'active')
    ),

  constraint user_contact_method_phone_login_requires_sms_check
    check (
      contact_method_type <> 'phone'
      or login_enabled = false
      or sms_capable = true
    )
);

alter table identity.user_contact_method enable row level security;

create unique index if not exists user_contact_method_one_active_label_idx
  on identity.user_contact_method (user_account_id, contact_method_type, contact_label)
  where status = 'active';

create unique index if not exists user_contact_method_unique_login_contact_idx
  on identity.user_contact_method (contact_method_type, normalized_contact_value)
  where is_verified = true and login_enabled = true and status = 'active';

create index if not exists user_contact_method_user_account_idx
  on identity.user_contact_method (user_account_id, status);

create table if not exists identity.auth_provider_identity (
  auth_provider_identity_id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references identity.user_account(user_account_id),
  provider_name text not null,
  provider_user_id text not null,
  provider_email text null,
  provider_phone text null,
  linked_at timestamptz not null default now(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,

  constraint auth_provider_identity_status_check
    check (status in ('active', 'replaced', 'disabled')),

  constraint auth_provider_identity_provider_name_not_blank_check
    check (length(trim(provider_name)) > 0),

  constraint auth_provider_identity_provider_user_id_not_blank_check
    check (length(trim(provider_user_id)) > 0)
);

alter table identity.auth_provider_identity enable row level security;

create unique index if not exists auth_provider_identity_provider_user_unique_idx
  on identity.auth_provider_identity (provider_name, provider_user_id)
  where status = 'active';

create index if not exists auth_provider_identity_user_account_idx
  on identity.auth_provider_identity (user_account_id, status);

create table if not exists identity.verification_challenge (
  verification_challenge_id uuid primary key default gen_random_uuid(),
  user_account_id uuid null references identity.user_account(user_account_id),
  user_contact_method_id uuid null references identity.user_contact_method(user_contact_method_id),
  normalized_contact_value text not null,
  contact_method_type text not null,
  purpose text not null,
  delivery_channel text not null,
  code_hash text null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  invalidated_at timestamptz null,
  failed_attempt_count integer not null default 0,
  resend_count integer not null default 0,
  locked_until timestamptz null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint verification_challenge_contact_method_type_check
    check (contact_method_type in ('email', 'phone')),

  constraint verification_challenge_purpose_check
    check (purpose in ('login', 'password_reset', 'contact_verify', 'first_admin_setup', 'role_reentry')),

  constraint verification_challenge_delivery_channel_check
    check (delivery_channel in ('email', 'sms')),

  constraint verification_challenge_failed_attempt_count_check
    check (failed_attempt_count >= 0 and failed_attempt_count <= 5),

  constraint verification_challenge_resend_count_check
    check (resend_count >= 0),

  constraint verification_challenge_contact_delivery_alignment_check
    check (
      (contact_method_type = 'email' and delivery_channel = 'email')
      or
      (contact_method_type = 'phone' and delivery_channel = 'sms')
    )
);

alter table identity.verification_challenge enable row level security;

create index if not exists verification_challenge_contact_purpose_expiry_idx
  on identity.verification_challenge (normalized_contact_value, purpose, expires_at);

create index if not exists verification_challenge_user_account_idx
  on identity.verification_challenge (user_account_id, created_at desc);

create table if not exists identity.login_attempt (
  login_attempt_id uuid primary key default gen_random_uuid(),
  user_account_id uuid null references identity.user_account(user_account_id),
  requested_role_context text not null,
  login_identifier_type text not null,
  normalized_login_identifier text not null,
  attempt_status text not null,
  failure_reason text null,
  ip_address text null,
  user_agent text null,
  created_at timestamptz not null default now(),

  constraint login_attempt_requested_role_context_check
    check (requested_role_context in ('admin', 'guide', 'explorer')),

  constraint login_attempt_identifier_type_check
    check (login_identifier_type in ('username', 'email', 'phone')),

  constraint login_attempt_status_check
    check (attempt_status in ('started', 'challenge_sent', 'success', 'failed', 'locked', 'abandoned'))
);

alter table identity.login_attempt enable row level security;

create index if not exists login_attempt_identifier_created_idx
  on identity.login_attempt (normalized_login_identifier, created_at desc);

create index if not exists login_attempt_user_account_created_idx
  on identity.login_attempt (user_account_id, created_at desc);

create table if not exists identity.user_session (
  user_session_id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references identity.user_account(user_account_id),
  active_role_context text not null references identity.role_type(role_code),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz null,
  last_activity_at timestamptz null,
  session_status text not null default 'active',
  verification_challenge_id uuid null references identity.verification_challenge(verification_challenge_id),
  ip_address text null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb,

  constraint user_session_status_check
    check (session_status in ('active', 'expired', 'logged_out', 'revoked')),

  constraint user_session_expiry_after_creation_check
    check (expires_at > created_at)
);

alter table identity.user_session enable row level security;

create index if not exists user_session_account_role_status_idx
  on identity.user_session (user_account_id, active_role_context, session_status);

create table if not exists audit.audit_event (
  audit_event_id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_user_account_id uuid null references identity.user_account(user_account_id),
  actor_role_context text not null,
  target_entity_type text null,
  target_entity_id uuid null,
  action text not null,
  reason_code text null,
  event_summary text not null,
  ip_address text null,
  user_agent text null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint audit_event_actor_role_context_check
    check (actor_role_context in ('admin', 'guide', 'explorer', 'system')),

  constraint audit_event_event_type_not_blank_check
    check (length(trim(event_type)) > 0),

  constraint audit_event_action_not_blank_check
    check (length(trim(action)) > 0)
);

alter table audit.audit_event enable row level security;

create index if not exists audit_event_actor_created_idx
  on audit.audit_event (actor_user_account_id, created_at desc);

create index if not exists audit_event_target_created_idx
  on audit.audit_event (target_entity_type, target_entity_id, created_at desc);

create index if not exists audit_event_type_created_idx
  on audit.audit_event (event_type, created_at desc);

comment on schema identity is 'SolMind-owned identity, role, contact, verification, and role-context session tables.';
comment on schema core is 'SolMind-owned product core schema reserved for organization, practice, Guide, Explorer, onboarding, and feedback tables.';
comment on schema audit is 'SolMind-owned audit and security event schema.';

comment on table identity.role_type is 'Controlled SolMind role reference values: Admin, Guide, Explorer.';
comment on table identity.user_account is 'Base SolMind application account record for humans using the product.';
comment on table identity.user_role_assignment is 'Role assignments for one account holding one or more SolMind roles.';
comment on table identity.user_contact_method is 'Email and phone contact methods used for login, verification, and recovery eligibility.';
comment on table identity.auth_provider_identity is 'Mapping between SolMind user accounts and provider/platform auth identities.';
comment on table identity.verification_challenge is 'Short-lived email/SMS verification challenge metadata; stores hashes/tokens only, never plaintext codes.';
comment on table identity.login_attempt is 'Login attempt telemetry and security event context.';
comment on table identity.user_session is 'SolMind login/security session with immutable active role context.';
comment on table audit.audit_event is 'General audit trail for access, security, workflow, publication, deletion, and support events.';
