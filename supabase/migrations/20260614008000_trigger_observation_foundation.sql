-- SolMind MVP0 Trigger Observation Foundation.
-- Purpose:
--   - add possible trigger pattern or recurring concern records for Guide review
--   - support cautious safety-adjacent observation tracking without creating safety flags or escalations
--   - preserve AI/session/message provenance for later review and reporting
--
-- This migration intentionally creates no users, no policies, no grants,
-- no real pilot data, no seed data, no UI, no safety flags,
-- no escalation records, no notification delivery, no safety classifier runtime,
-- and no storage buckets.

create table if not exists content.trigger_observation (
  trigger_observation_id uuid primary key default gen_random_uuid(),
  guide_explorer_relationship_id uuid not null references core.guide_explorer_relationship(guide_explorer_relationship_id),
  source_ai_interaction_session_id uuid null references ai.ai_interaction_session(ai_interaction_session_id),
  source_ai_interaction_message_id uuid null references ai.ai_interaction_message(ai_interaction_message_id),
  source_summary_revision_id uuid null,
  trigger_label text not null,
  observation_text text not null,
  observation_window_start timestamptz null,
  observation_window_end timestamptz null,
  occurrence_count integer null,
  confidence_level text not null default 'low',
  review_status text not null default 'needs_review',
  created_by_actor_type text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'sensitive_content',

  constraint trigger_observation_label_not_blank_check
    check (length(trim(trigger_label)) > 0),

  constraint trigger_observation_text_not_blank_check
    check (length(trim(observation_text)) > 0),

  constraint trigger_observation_window_order_check
    check (
      observation_window_start is null
      or observation_window_end is null
      or observation_window_end >= observation_window_start
    ),

  constraint trigger_observation_occurrence_count_check
    check (occurrence_count is null or occurrence_count > 0),

  constraint trigger_observation_confidence_level_check
    check (confidence_level in ('low', 'medium', 'high')),

  constraint trigger_observation_review_status_check
    check (review_status in ('needs_review', 'guide_acknowledged', 'dismissed', 'converted_to_note', 'escalated')),

  constraint trigger_observation_created_by_actor_type_check
    check (created_by_actor_type in ('solmind_virtual_guide', 'solmind_guide_assistant', 'guide', 'admin')),

  constraint trigger_observation_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint trigger_observation_retention_class_check
    check (retention_class = 'sensitive_content')
);

alter table content.trigger_observation enable row level security;

create index if not exists trigger_observation_relationship_created_idx
  on content.trigger_observation (guide_explorer_relationship_id, created_at desc);

create index if not exists trigger_observation_relationship_review_created_idx
  on content.trigger_observation (guide_explorer_relationship_id, review_status, created_at desc);

create index if not exists trigger_observation_source_session_idx
  on content.trigger_observation (source_ai_interaction_session_id)
  where source_ai_interaction_session_id is not null;

create index if not exists trigger_observation_source_message_idx
  on content.trigger_observation (source_ai_interaction_message_id)
  where source_ai_interaction_message_id is not null;

create index if not exists trigger_observation_label_created_idx
  on content.trigger_observation (trigger_label, created_at desc);

comment on table content.trigger_observation is
  'Possible trigger pattern or recurring concern surfaced for Guide review. Use cautious language such as possible pattern, potential trigger, or may be worth reviewing.';

comment on column content.trigger_observation.trigger_label is
  'Short human-reviewable label for the possible pattern or potential trigger.';

comment on column content.trigger_observation.observation_text is
  'Human-reviewable observation text. This is sensitive derived Explorer content and must not be duplicated into audit metadata.';

comment on column content.trigger_observation.source_ai_interaction_session_id is
  'Nullable AI Interaction Session provenance for the observation.';

comment on column content.trigger_observation.source_ai_interaction_message_id is
  'Nullable AI Interaction Message provenance for the observation.';

comment on column content.trigger_observation.source_summary_revision_id is
  'Nullable future FK target to content.summary_revision. Kept as uuid only until summary tables exist.';

comment on column content.trigger_observation.confidence_level is
  'Low, medium, or high confidence only; never absolute.';

comment on column content.trigger_observation.review_status is
  'Guide/system review lifecycle for the observation. Escalated status does not itself create an escalation record in this slice.';