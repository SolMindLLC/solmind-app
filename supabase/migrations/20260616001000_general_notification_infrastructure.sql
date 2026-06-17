-- SolMind MVP0 General Notification Infrastructure.
-- Purpose:
--   - add notification preferences for user/channel/category routing
--   - add generalized notification attempt records for future delivery tracking
--   - connect escalation notifications to generalized notification attempts through the previously deferred FK target
--   - support future safety, check-in, summary-review, and system notification workflows without adding delivery runtime
--
-- This migration intentionally creates no users, no policies, no grants,
-- no real pilot data, no active consent seed data, no seed data, no UI,
-- no runtime notification delivery, no provider integration, no email/SMS sending,
-- no notification scheduler, no permissive RLS policies, and no storage buckets.
--
-- Deferred to later slices:
--   - notification delivery runtime and provider integration
--   - in-app notification UI
--   - notification scheduling and retry worker
--   - default preference creation logic
--   - RLS policies and SQL grants

create schema if not exists notification;

create table if not exists notification.notification_preference (
  notification_preference_id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references identity.user_account(user_account_id),
  role_context text not null,
  channel text not null,
  notification_category text not null,
  is_enabled boolean not null default true,
  is_required boolean not null default false,
  verified_contact_method_id uuid null references identity.user_contact_method(user_contact_method_id),
  quiet_hours_json jsonb null,
  created_at timestamptz not null default now(),
  created_by_user_account_id uuid null references identity.user_account(user_account_id),
  updated_at timestamptz null,
  updated_by_user_account_id uuid null references identity.user_account(user_account_id),
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'security_log',

  constraint notification_preference_role_context_check
    check (role_context in ('admin', 'guide', 'explorer')),

  constraint notification_preference_channel_check
    check (channel in ('in_app', 'email', 'sms')),

  constraint notification_preference_category_check
    check (notification_category in ('safety_escalation', 'summary_review', 'check_in_reminder', 'appointment_reminder', 'system')),

  constraint notification_preference_required_enabled_check
    check (is_enabled or is_required = false),

  constraint notification_preference_contact_method_channel_check
    check (
      (channel = 'in_app' and verified_contact_method_id is null)
      or (channel in ('email', 'sms'))
    ),

  constraint notification_preference_quiet_hours_object_check
    check (quiet_hours_json is null or jsonb_typeof(quiet_hours_json) = 'object'),

  constraint notification_preference_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint notification_preference_retention_class_check
    check (retention_class = 'security_log'),

  constraint notification_preference_updated_fields_check
    check (
      (updated_at is null and updated_by_user_account_id is null)
      or (updated_at is not null)
    ),

  constraint notification_preference_user_role_channel_category_unique
    unique (user_account_id, role_context, channel, notification_category)
);

alter table notification.notification_preference enable row level security;

create table if not exists notification.notification_attempt (
  notification_attempt_id uuid primary key default gen_random_uuid(),
  recipient_user_account_id uuid not null references identity.user_account(user_account_id),
  recipient_role_context text not null,
  channel text not null,
  notification_category text not null,
  purpose text not null,
  dispatch_status text not null default 'queued',
  attempt_number integer not null default 1,
  scheduled_for timestamptz null,
  next_retry_at timestamptz null,
  provider_name text null,
  provider_message_id text null,
  error_code text null,
  error_summary text null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  delivered_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'security_log',

  constraint notification_attempt_recipient_role_context_check
    check (recipient_role_context in ('admin', 'guide', 'explorer')),

  constraint notification_attempt_channel_check
    check (channel in ('in_app', 'email', 'sms')),

  constraint notification_attempt_category_check
    check (notification_category in ('safety_escalation', 'summary_review', 'check_in_reminder', 'appointment_reminder', 'system')),

  constraint notification_attempt_purpose_check
    check (purpose in ('initial_alert', 'renotification', 'reminder', 'review_ready', 'system_notice')),

  constraint notification_attempt_dispatch_status_check
    check (dispatch_status in ('queued', 'sent', 'delivered', 'failed', 'skipped', 'suppressed', 'canceled')),

  constraint notification_attempt_number_check
    check (attempt_number >= 1),

  constraint notification_attempt_provider_name_not_blank_check
    check (provider_name is null or length(trim(provider_name)) > 0),

  constraint notification_attempt_provider_message_id_not_blank_check
    check (provider_message_id is null or length(trim(provider_message_id)) > 0),

  constraint notification_attempt_error_code_not_blank_check
    check (error_code is null or length(trim(error_code)) > 0),

  constraint notification_attempt_error_summary_not_blank_check
    check (error_summary is null or length(trim(error_summary)) > 0),

  constraint notification_attempt_sent_time_order_check
    check (sent_at is null or sent_at >= created_at),

  constraint notification_attempt_delivered_time_order_check
    check (delivered_at is null or sent_at is not null),

  constraint notification_attempt_failed_error_check
    check (
      (dispatch_status = 'failed' and error_summary is not null)
      or (dispatch_status <> 'failed')
    ),

  constraint notification_attempt_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint notification_attempt_retention_class_check
    check (retention_class = 'security_log')
);

alter table notification.notification_attempt enable row level security;

alter table notification.escalation_notification
  add constraint escalation_notification_attempt_fk
  foreign key (notification_attempt_id)
  references notification.notification_attempt(notification_attempt_id);

create index if not exists notification_preference_user_role_idx
  on notification.notification_preference (user_account_id, role_context);

create index if not exists notification_preference_channel_category_enabled_idx
  on notification.notification_preference (channel, notification_category, is_enabled);

create index if not exists notification_preference_contact_method_idx
  on notification.notification_preference (verified_contact_method_id)
  where verified_contact_method_id is not null;

create index if not exists notification_attempt_recipient_created_idx
  on notification.notification_attempt (recipient_user_account_id, created_at desc);

create index if not exists notification_attempt_status_retry_idx
  on notification.notification_attempt (dispatch_status, next_retry_at);

create index if not exists notification_attempt_channel_status_created_idx
  on notification.notification_attempt (channel, dispatch_status, created_at desc);

create index if not exists notification_attempt_category_created_idx
  on notification.notification_attempt (notification_category, created_at desc);

comment on table notification.notification_preference is
  'User notification preference foundation by role context, channel, and notification category. This slice creates no default preferences and sends no notifications.';

comment on table notification.notification_attempt is
  'General notification attempt record for future in-app, email, and SMS delivery tracking. This slice adds no provider integration or runtime delivery.';

comment on column notification.notification_preference.notification_category is
  'MVP0 notification category such as safety escalation, summary review, check-in reminder, appointment reminder, or system notice.';

comment on column notification.notification_preference.is_required is
  'Required preferences may be used later for safety-critical routing. Application logic must decide whether and how required routing can be changed.';

comment on column notification.notification_preference.quiet_hours_json is
  'Optional future quiet-hours configuration. Application logic validates shape and timezone behavior.';

comment on column notification.notification_attempt.notification_category is
  'Category of notification event being attempted, such as safety escalation or summary review.';

comment on column notification.notification_attempt.provider_name is
  'Notification provider name, if applicable. Not a secret.';

comment on column notification.notification_attempt.provider_message_id is
  'Provider message identifier, if applicable. Not a secret, but should not contain raw message content.';

comment on column notification.notification_attempt.metadata is
  'Non-secret operational metadata only. Do not store provider secrets, API keys, raw Explorer content, or full notification body text.';