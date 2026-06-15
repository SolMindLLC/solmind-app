-- SolMind MVP0 Safety, Escalation, and Notification Foundation.
-- Purpose:
--   - add content.safety_flag records for AI-surfaced safety concerns awaiting human review
--   - add content.escalation_record to track Guide/Admin/safety/support escalation lifecycle
--   - add notification.escalation_notification as schema foundation for escalation alerts
--   - preserve AI/session/message and safety/trigger provenance for later review and reporting
--
-- This migration intentionally creates no users, no policies, no grants,
-- no real pilot data, no active consent seed data, no seed data, no UI,
-- no runtime notification delivery, no provider/runtime delivery code,
-- no safety classifier runtime, and no storage buckets.
--
-- Deferred to later slices:
--   - notification.notification_attempt (forward reference kept as nullable uuid only)
--   - notification.notification_preference
--   - notification delivery runtime and email/SMS provider integration
--   - RLS policies and SQL grants

create schema if not exists content;
create schema if not exists notification;

create table if not exists content.safety_flag (
  safety_flag_id uuid primary key default gen_random_uuid(),
  guide_explorer_relationship_id uuid not null references core.guide_explorer_relationship(guide_explorer_relationship_id),
  source_ai_interaction_session_id uuid null references ai.ai_interaction_session(ai_interaction_session_id),
  source_ai_interaction_message_id uuid null references ai.ai_interaction_message(ai_interaction_message_id),
  flag_type text not null,
  severity text not null,
  flag_text text not null,
  review_status text not null default 'new',
  created_at timestamptz not null default now(),
  reviewed_by_user_account_id uuid null references identity.user_account(user_account_id),
  reviewed_at timestamptz null,
  retention_class text not null default 'sensitive_content',

  constraint safety_flag_flag_type_check
    check (flag_type in ('self_harm_reference', 'violence_reference', 'abuse_concern', 'crisis_language', 'other')),

  constraint safety_flag_severity_check
    check (severity in ('low', 'medium', 'high', 'urgent')),

  constraint safety_flag_review_status_check
    check (review_status in ('new', 'reviewed', 'dismissed', 'escalated', 'resolved')),

  constraint safety_flag_text_not_blank_check
    check (length(trim(flag_text)) > 0),

  constraint safety_flag_reviewed_consistency_check
    check (reviewed_at is null or reviewed_by_user_account_id is not null),

  constraint safety_flag_retention_class_check
    check (retention_class = 'sensitive_content')
);

alter table content.safety_flag enable row level security;

create index if not exists safety_flag_relationship_review_created_idx
  on content.safety_flag (guide_explorer_relationship_id, review_status, created_at desc);

create index if not exists safety_flag_severity_created_idx
  on content.safety_flag (severity, created_at desc);

create index if not exists safety_flag_source_session_idx
  on content.safety_flag (source_ai_interaction_session_id)
  where source_ai_interaction_session_id is not null;

create index if not exists safety_flag_source_message_idx
  on content.safety_flag (source_ai_interaction_message_id)
  where source_ai_interaction_message_id is not null;

comment on table content.safety_flag is
  'AI-surfaced safety concern awaiting human review. Sensitive derived Explorer content; must not be duplicated into audit metadata.';

comment on column content.safety_flag.source_ai_interaction_session_id is
  'Nullable AI Interaction Session provenance for the safety flag.';

comment on column content.safety_flag.source_ai_interaction_message_id is
  'Nullable AI Interaction Message provenance for the safety flag.';

comment on column content.safety_flag.review_status is
  'Human review lifecycle for the safety flag. Escalated status does not itself create an escalation record in this slice.';

create table if not exists content.escalation_record (
  escalation_record_id uuid primary key default gen_random_uuid(),
  safety_flag_id uuid null references content.safety_flag(safety_flag_id),
  trigger_observation_id uuid null references content.trigger_observation(trigger_observation_id),
  guide_explorer_relationship_id uuid not null references core.guide_explorer_relationship(guide_explorer_relationship_id),
  escalation_type text not null,
  escalation_status text not null default 'open',
  opened_at timestamptz not null default now(),
  opened_by_actor_type text not null,
  closed_at timestamptz null,
  resolution_notes text null,
  escalation_level integer null,
  acknowledged_at timestamptz null,
  acknowledged_by_user_account_id uuid null references identity.user_account(user_account_id),
  acknowledged_by_role_context text null,
  last_renotification_at timestamptz null,
  renotification_count integer not null default 0,
  retention_class text not null default 'sensitive_content',

  constraint escalation_record_escalation_type_check
    check (escalation_type in ('guide_review', 'admin_review', 'safety_review', 'support_review')),

  constraint escalation_record_escalation_status_check
    check (escalation_status in ('open', 'in_review', 'closed', 'dismissed')),

  constraint escalation_record_opened_by_actor_type_check
    check (opened_by_actor_type in ('solmind_virtual_guide', 'solmind_guide_assistant', 'guide', 'admin', 'system')),

  constraint escalation_record_escalation_level_check
    check (escalation_level is null or escalation_level in (3, 4)),

  constraint escalation_record_acknowledged_role_context_check
    check (acknowledged_by_role_context is null or acknowledged_by_role_context in ('guide', 'admin')),

  constraint escalation_record_renotification_count_check
    check (renotification_count >= 0),

  constraint escalation_record_source_presence_check
    check (safety_flag_id is not null or trigger_observation_id is not null),

  constraint escalation_record_closed_consistency_check
    check (escalation_status not in ('closed', 'dismissed') or closed_at is not null),

  constraint escalation_record_retention_class_check
    check (retention_class = 'sensitive_content')
);

alter table content.escalation_record enable row level security;

create index if not exists escalation_record_relationship_status_opened_idx
  on content.escalation_record (guide_explorer_relationship_id, escalation_status, opened_at desc);

create index if not exists escalation_record_safety_flag_idx
  on content.escalation_record (safety_flag_id)
  where safety_flag_id is not null;

create index if not exists escalation_record_trigger_observation_idx
  on content.escalation_record (trigger_observation_id)
  where trigger_observation_id is not null;

create index if not exists escalation_record_level_opened_idx
  on content.escalation_record (escalation_level, opened_at desc)
  where escalation_level is not null;

create index if not exists escalation_record_status_opened_idx
  on content.escalation_record (escalation_status, opened_at desc);

comment on table content.escalation_record is
  'Escalation lifecycle record linked to a safety flag and/or trigger observation. Sensitive derived Explorer content; must not be duplicated into audit metadata.';

comment on column content.escalation_record.escalation_level is
  'Optional escalation level; only levels 3 or 4 are valid when set.';

comment on column content.escalation_record.acknowledged_by_role_context is
  'Role context in which the escalation was acknowledged; guide or admin only.';

create table if not exists notification.escalation_notification (
  escalation_notification_id uuid primary key default gen_random_uuid(),
  escalation_record_id uuid not null references content.escalation_record(escalation_record_id),
  safety_flag_id uuid null references content.safety_flag(safety_flag_id),
  recipient_user_account_id uuid not null references identity.user_account(user_account_id),
  recipient_role_context text not null,
  channel text not null,
  purpose text not null,
  dispatch_status text not null default 'queued',
  skip_reason text null,
  attempt_number integer not null,
  next_retry_at timestamptz null,
  notification_attempt_id uuid null,
  provider_name text null,
  provider_message_id text null,
  error_code text null,
  error_summary text null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  delivered_at timestamptz null,
  retention_class text not null default 'security_log',
  metadata jsonb null,

  constraint escalation_notification_recipient_role_context_check
    check (recipient_role_context in ('guide', 'admin')),

  constraint escalation_notification_channel_check
    check (channel in ('in_app', 'email', 'sms')),

  constraint escalation_notification_purpose_check
    check (purpose in ('initial_alert', 'renotification')),

  constraint escalation_notification_dispatch_status_check
    check (dispatch_status in ('queued', 'sent', 'delivered', 'failed', 'skipped', 'suppressed')),

  constraint escalation_notification_skip_reason_value_check
    check (skip_reason is null or skip_reason in ('sms_feature_flag_inactive', 'recipient_not_opted_in', 'no_verified_contact_method', 'channel_unavailable')),

  constraint escalation_notification_skip_reason_consistency_check
    check ((dispatch_status in ('skipped', 'suppressed')) = (skip_reason is not null)),

  constraint escalation_notification_attempt_number_check
    check (attempt_number >= 1),

  constraint escalation_notification_provider_name_not_blank_check
    check (provider_name is null or length(trim(provider_name)) > 0),

  constraint escalation_notification_provider_message_id_not_blank_check
    check (provider_message_id is null or length(trim(provider_message_id)) > 0),

  constraint escalation_notification_error_code_not_blank_check
    check (error_code is null or length(trim(error_code)) > 0),

  constraint escalation_notification_error_summary_not_blank_check
    check (error_summary is null or length(trim(error_summary)) > 0),

  constraint escalation_notification_metadata_object_check
    check (metadata is null or jsonb_typeof(metadata) = 'object'),

  constraint escalation_notification_retention_class_check
    check (retention_class = 'security_log')
);

alter table notification.escalation_notification enable row level security;

create index if not exists escalation_notification_record_created_idx
  on notification.escalation_notification (escalation_record_id, created_at desc);

create index if not exists escalation_notification_safety_flag_idx
  on notification.escalation_notification (safety_flag_id)
  where safety_flag_id is not null;

create index if not exists escalation_notification_recipient_created_idx
  on notification.escalation_notification (recipient_user_account_id, created_at desc);

create index if not exists escalation_notification_dispatch_retry_idx
  on notification.escalation_notification (dispatch_status, next_retry_at);

create index if not exists escalation_notification_channel_status_created_idx
  on notification.escalation_notification (channel, dispatch_status, created_at desc);

comment on table notification.escalation_notification is
  'Schema foundation for escalation notification dispatch records. This slice adds no notification runtime, provider delivery, or retry processing.';

comment on column notification.escalation_notification.notification_attempt_id is
  'Nullable future FK target to notification.notification_attempt. Kept as uuid only until the notification_attempt table exists; no foreign key is enforced in this slice.';

comment on column notification.escalation_notification.skip_reason is
  'Reason a dispatch was skipped or suppressed. Required when dispatch_status is skipped or suppressed, and must be null otherwise.';
