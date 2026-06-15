-- SolMind MVP0 Check-in Foundation.
-- Purpose:
--   - add structured Explorer check-in records
--   - add MVP0-simple check-in cadence configuration per Guide/Explorer relationship
--   - support daily rhythm and future non-safety check-in prompt reminders
--
-- This migration intentionally creates no users, no policies, no grants,
-- no real pilot data, no seed data, no UI, no check-in reminder generation,
-- no notification delivery, no scheduling engine beyond future next-window computation,
-- and no storage buckets.

create table if not exists content.check_in (
  check_in_id uuid primary key default gen_random_uuid(),
  guide_explorer_relationship_id uuid not null references core.guide_explorer_relationship(guide_explorer_relationship_id),
  ai_interaction_session_id uuid null references ai.ai_interaction_session(ai_interaction_session_id),
  check_in_type text not null default 'daily',
  check_in_status text not null default 'started',
  response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'sensitive_content',

  constraint check_in_type_check
    check (check_in_type in ('daily', 'manual', 'pre_appointment', 'post_appointment', 'other')),

  constraint check_in_status_check
    check (check_in_status in ('started', 'completed', 'abandoned', 'skipped')),

  constraint check_in_response_json_object_check
    check (jsonb_typeof(response_json) = 'object'),

  constraint check_in_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint check_in_retention_class_check
    check (retention_class = 'sensitive_content'),

  constraint check_in_completed_at_check
    check (
      (check_in_status = 'completed' and completed_at is not null)
      or (check_in_status <> 'completed')
    ),

  constraint check_in_completed_time_order_check
    check (completed_at is null or completed_at >= created_at)
);

alter table content.check_in enable row level security;

create index if not exists check_in_relationship_created_idx
  on content.check_in (guide_explorer_relationship_id, created_at desc);

create index if not exists check_in_relationship_status_created_idx
  on content.check_in (guide_explorer_relationship_id, check_in_status, created_at desc);

create index if not exists check_in_ai_session_idx
  on content.check_in (ai_interaction_session_id)
  where ai_interaction_session_id is not null;

create table if not exists content.check_in_schedule (
  check_in_schedule_id uuid primary key default gen_random_uuid(),
  guide_explorer_relationship_id uuid not null references core.guide_explorer_relationship(guide_explorer_relationship_id),
  is_enabled boolean not null default true,
  frequency text not null default 'daily_once',
  preferred_time_windows jsonb null,
  timezone text not null,
  paused boolean not null default false,
  paused_until timestamptz null,
  explorer_adjustable boolean not null default true,
  created_at timestamptz not null default now(),
  created_by_user_account_id uuid null references identity.user_account(user_account_id),
  created_by_role_context text null,
  updated_at timestamptz null,
  updated_by_user_account_id uuid null references identity.user_account(user_account_id),
  updated_by_role_context text null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'core_business',

  constraint check_in_schedule_frequency_check
    check (frequency in ('daily_once', 'daily_twice', 'daily_three_times', 'custom_future')),

  constraint check_in_schedule_timezone_not_blank_check
    check (length(trim(timezone)) > 0),

  constraint check_in_schedule_preferred_time_windows_array_check
    check (preferred_time_windows is null or jsonb_typeof(preferred_time_windows) = 'array'),

  constraint check_in_schedule_created_by_role_context_check
    check (created_by_role_context is null or created_by_role_context in ('admin', 'guide', 'explorer')),

  constraint check_in_schedule_updated_by_role_context_check
    check (updated_by_role_context is null or updated_by_role_context in ('admin', 'guide', 'explorer')),

  constraint check_in_schedule_status_check
    check (status in ('active', 'inactive', 'deleted')),

  constraint check_in_schedule_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint check_in_schedule_retention_class_check
    check (retention_class = 'core_business'),

  constraint check_in_schedule_paused_until_check
    check (paused or paused_until is null),

  constraint check_in_schedule_updated_fields_check
    check (
      (updated_at is null and updated_by_user_account_id is null and updated_by_role_context is null)
      or (updated_at is not null)
    )
);

alter table content.check_in_schedule enable row level security;

create unique index if not exists check_in_schedule_one_active_relationship_idx
  on content.check_in_schedule (guide_explorer_relationship_id)
  where status = 'active';

create index if not exists check_in_schedule_relationship_status_idx
  on content.check_in_schedule (guide_explorer_relationship_id, status);

create index if not exists check_in_schedule_enabled_paused_idx
  on content.check_in_schedule (is_enabled, paused, status);

comment on table content.check_in is
  'Structured Explorer check-in record. Response JSON is acceptable for MVP0 and may later be normalized.';

comment on table content.check_in_schedule is
  'MVP0-simple cadence configuration for Explorer check-ins, Guide-adjustable per relationship. Reminder generation and notification delivery are deferred.';

comment on column content.check_in.response_json is
  'Flexible MVP0 check-in response payload. This is sensitive Explorer content.';

comment on column content.check_in.ai_interaction_session_id is
  'Nullable AI Interaction Session link, likely set for AI-assisted check-ins.';

comment on column content.check_in_schedule.preferred_time_windows is
  'Optional array of local time windows, such as morning, afternoon, or evening windows. Application logic validates count against frequency.';

comment on column content.check_in_schedule.paused is
  'Explorer may always pause check-ins, even when explorer_adjustable is false.';

comment on column content.check_in_schedule.frequency is
  'MVP0 UI offers daily_once, daily_twice, and daily_three_times. custom_future is reserved.';