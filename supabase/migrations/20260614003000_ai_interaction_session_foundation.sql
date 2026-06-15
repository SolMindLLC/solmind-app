-- SolMind MVP0 AI Interaction Session Foundation.
-- Purpose:
--   - create ai schema for bounded AI interaction data
--   - add AI Interaction Session records
--   - add ordered AI Interaction Message records
--
-- This migration intentionally creates no users, no policies, no grants,
-- no real pilot data, no seed data, no UI, no AI context snapshots,
-- no model invocation logs, no AI artifacts, no prompt assembly logic,
-- no model provider calls, no summary/reflection extraction logic,
-- and no storage buckets.

create schema if not exists ai;

create table if not exists ai.ai_interaction_session (
  ai_interaction_session_id uuid primary key default gen_random_uuid(),
  session_type text not null,
  session_status text not null default 'active',
  actor_user_account_id uuid not null references identity.user_account(user_account_id),
  actor_role_context text not null,
  guide_profile_id uuid null references core.guide_profile(guide_profile_id),
  explorer_profile_id uuid null references core.explorer_profile(explorer_profile_id),
  guide_explorer_relationship_id uuid null references core.guide_explorer_relationship(guide_explorer_relationship_id),
  practice_id uuid null references core.practice(practice_id),
  appointment_id uuid null references scheduling.appointment(appointment_id),
  title text null,
  generated_title text null,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  paused_at timestamptz null,
  ended_at timestamptz null,
  archived_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'sensitive_content',

  constraint ai_interaction_session_type_check
    check (
      session_type in (
        'explorer_reflection',
        'explorer_check_in',
        'explorer_waypoint',
        'guide_prep',
        'guide_summary_review',
        'guide_methodology',
        'admin_methodology_conversion',
        'admin_support_debug'
      )
    ),

  constraint ai_interaction_session_status_check
    check (session_status in ('active', 'paused', 'ended', 'archived')),

  constraint ai_interaction_session_actor_role_context_check
    check (actor_role_context in ('admin', 'guide', 'explorer')),

  constraint ai_interaction_session_retention_class_check
    check (retention_class = 'sensitive_content'),

  constraint ai_interaction_session_title_not_blank_check
    check (title is null or length(trim(title)) > 0),

  constraint ai_interaction_session_generated_title_not_blank_check
    check (generated_title is null or length(trim(generated_title)) > 0),

  constraint ai_interaction_session_activity_order_check
    check (last_activity_at >= started_at),

  constraint ai_interaction_session_paused_at_check
    check (
      (session_status = 'paused' and paused_at is not null)
      or (session_status <> 'paused')
    ),

  constraint ai_interaction_session_ended_at_check
    check (
      (session_status in ('ended', 'archived') and ended_at is not null)
      or (session_status not in ('ended', 'archived'))
    ),

  constraint ai_interaction_session_archived_at_check
    check (
      (session_status = 'archived' and archived_at is not null)
      or (session_status <> 'archived' and archived_at is null)
    ),

  constraint ai_interaction_session_role_context_shape_check
    check (
      (actor_role_context = 'admin')
      or (actor_role_context = 'guide' and guide_profile_id is not null)
      or (
        actor_role_context = 'explorer'
        and explorer_profile_id is not null
        and guide_explorer_relationship_id is not null
      )
    )
);

alter table ai.ai_interaction_session enable row level security;

create index if not exists ai_interaction_session_actor_status_idx
  on ai.ai_interaction_session (actor_user_account_id, actor_role_context, session_status);

create index if not exists ai_interaction_session_relationship_started_idx
  on ai.ai_interaction_session (guide_explorer_relationship_id, started_at desc)
  where guide_explorer_relationship_id is not null;

create index if not exists ai_interaction_session_appointment_idx
  on ai.ai_interaction_session (appointment_id)
  where appointment_id is not null;

create index if not exists ai_interaction_session_last_activity_idx
  on ai.ai_interaction_session (last_activity_at);

create table if not exists ai.ai_interaction_message (
  ai_interaction_message_id uuid primary key default gen_random_uuid(),
  ai_interaction_session_id uuid not null references ai.ai_interaction_session(ai_interaction_session_id),
  sequence_number integer not null,
  sender_type text not null,
  sender_user_account_id uuid null references identity.user_account(user_account_id),
  sender_role_context text null,
  ai_role text null,
  content_text text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'sensitive_content',

  constraint ai_interaction_message_sequence_number_check
    check (sequence_number > 0),

  constraint ai_interaction_message_sender_type_check
    check (sender_type in ('user', 'ai', 'system', 'tool')),

  constraint ai_interaction_message_sender_role_context_check
    check (sender_role_context is null or sender_role_context in ('admin', 'guide', 'explorer')),

  constraint ai_interaction_message_ai_role_check
    check (
      ai_role is null
      or ai_role in ('solmind_virtual_guide', 'solmind_guide_assistant', 'internal_admin_ai')
    ),

  constraint ai_interaction_message_content_not_blank_check
    check (length(trim(content_text)) > 0),

  constraint ai_interaction_message_retention_class_check
    check (retention_class = 'sensitive_content'),

  constraint ai_interaction_message_user_sender_check
    check (
      (sender_type = 'user' and sender_user_account_id is not null and sender_role_context is not null and ai_role is null)
      or (sender_type <> 'user')
    ),

  constraint ai_interaction_message_ai_sender_check
    check (
      (sender_type = 'ai' and sender_user_account_id is null and ai_role is not null)
      or (sender_type <> 'ai')
    ),

  constraint ai_interaction_message_system_tool_sender_check
    check (
      (sender_type in ('system', 'tool') and sender_user_account_id is null)
      or (sender_type not in ('system', 'tool'))
    ),

  constraint ai_interaction_message_session_sequence_unique
    unique (ai_interaction_session_id, sequence_number)
);

alter table ai.ai_interaction_message enable row level security;

create index if not exists ai_interaction_message_session_created_idx
  on ai.ai_interaction_message (ai_interaction_session_id, created_at);

create index if not exists ai_interaction_message_sender_user_created_idx
  on ai.ai_interaction_message (sender_user_account_id, created_at desc)
  where sender_user_account_id is not null;

comment on schema ai is 'SolMind MVP0 AI interaction session, message, context, and model metadata.';

comment on table ai.ai_interaction_session is
  'Bounded AI conversation or work session. A login session is not an AI Interaction Session.';

comment on table ai.ai_interaction_message is
  'Individual human, AI, system, or tool message within exactly one AI Interaction Session.';

comment on column ai.ai_interaction_session.metadata is
  'Flexible MVP0 metadata. Crisis restricted mode, if active, is represented here and does not alter session lifecycle values.';

comment on column ai.ai_interaction_session.appointment_id is
  'Nullable link to an appointment for guide prep or appointment-adjacent AI work.';

comment on column ai.ai_interaction_message.sequence_number is
  'Ordered message sequence within one AI Interaction Session.';

comment on column ai.ai_interaction_message.content_text is
  'Sensitive interaction content. Audit records must not duplicate message content.';