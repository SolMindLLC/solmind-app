-- SolMind MVP0 AI Context Snapshot Foundation.
-- Purpose:
--   - add AI context snapshot records for session/message context provenance
--   - support future Explorer-facing context inclusion/exclusion checks
--   - record prompt/template version and related context entity IDs without storing secrets
--
-- This migration intentionally creates no users, no policies, no grants,
-- no real pilot data, no seed data, no UI, no model invocation logs,
-- no prompt assembly runtime, no vector retrieval, no summary/reflection extraction logic,
-- and no storage buckets.

create table if not exists ai.ai_context_snapshot (
  ai_context_snapshot_id uuid primary key default gen_random_uuid(),
  ai_interaction_session_id uuid not null references ai.ai_interaction_session(ai_interaction_session_id),
  ai_interaction_message_id uuid null references ai.ai_interaction_message(ai_interaction_message_id),
  methodology_context_pack_version_id uuid null,
  prompt_version text not null,
  related_summary_revision_ids jsonb not null default '[]'::jsonb,
  related_waypoint_ids jsonb not null default '[]'::jsonb,
  related_trigger_observation_ids jsonb not null default '[]'::jsonb,
  related_reflection_ids jsonb not null default '[]'::jsonb,
  related_goal_focus_area_ids jsonb not null default '[]'::jsonb,
  context_summary text null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'sensitive_content',

  constraint ai_context_snapshot_prompt_version_not_blank_check
    check (length(trim(prompt_version)) > 0),

  constraint ai_context_snapshot_related_summary_revision_ids_array_check
    check (jsonb_typeof(related_summary_revision_ids) = 'array'),

  constraint ai_context_snapshot_related_waypoint_ids_array_check
    check (jsonb_typeof(related_waypoint_ids) = 'array'),

  constraint ai_context_snapshot_related_trigger_observation_ids_array_check
    check (jsonb_typeof(related_trigger_observation_ids) = 'array'),

  constraint ai_context_snapshot_related_reflection_ids_array_check
    check (jsonb_typeof(related_reflection_ids) = 'array'),

  constraint ai_context_snapshot_related_goal_focus_area_ids_array_check
    check (jsonb_typeof(related_goal_focus_area_ids) = 'array'),

  constraint ai_context_snapshot_context_summary_not_blank_check
    check (context_summary is null or length(trim(context_summary)) > 0),

  constraint ai_context_snapshot_retention_class_check
    check (retention_class = 'sensitive_content')
);

alter table ai.ai_context_snapshot enable row level security;

create index if not exists ai_context_snapshot_session_created_idx
  on ai.ai_context_snapshot (ai_interaction_session_id, created_at desc);

create index if not exists ai_context_snapshot_message_idx
  on ai.ai_context_snapshot (ai_interaction_message_id)
  where ai_interaction_message_id is not null;

create index if not exists ai_context_snapshot_prompt_version_created_idx
  on ai.ai_context_snapshot (prompt_version, created_at desc);

comment on table ai.ai_context_snapshot is
  'Record of which context informed an AI response or session. Context snapshots are sensitive content and must not store provider secrets, API keys, or environment variables.';

comment on column ai.ai_context_snapshot.ai_interaction_session_id is
  'AI Interaction Session whose assembled context is represented by this snapshot.';

comment on column ai.ai_context_snapshot.ai_interaction_message_id is
  'Nullable message link, often set for an AI response whose context is being recorded.';

comment on column ai.ai_context_snapshot.methodology_context_pack_version_id is
  'Nullable future FK target to methodology.methodology_context_pack_version. Kept as uuid only until methodology schema exists.';

comment on column ai.ai_context_snapshot.related_reflection_ids is
  'Array of content.reflection IDs included in context. Required for future Explorer-facing response provenance and exclusion tests.';

comment on column ai.ai_context_snapshot.context_summary is
  'Human-reviewable summary of context used; must not contain provider secrets or raw hidden prompt material.';