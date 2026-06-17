-- SolMind MVP0 Summary Foundation.
-- Purpose:
--   - add stable summary containers scoped to Guide/Explorer relationships
--   - add versioned summary revisions for Guide review and auditability
--   - connect trigger observations to summary revisions through the previously deferred FK target
--   - support future Guide dashboard summary review paths without adding UI or AI runtime
--
-- This migration intentionally creates no users, no policies, no grants,
-- no real pilot data, no active consent seed data, no seed data, no UI,
-- no summary generation runtime, no prompt templates, no notification delivery,
-- no permissive RLS policies, and no storage buckets.
--
-- Deferred to later slices:
--   - summary generation runtime and prompt assembly
--   - Guide dashboard UI
--   - Explorer-visible release workflow and consent UX
--   - notification delivery for summary review events
--   - application-layer lifecycle transition enforcement
--   - RLS policies and SQL grants

create table if not exists content.summary (
  summary_id uuid primary key default gen_random_uuid(),
  guide_explorer_relationship_id uuid not null references core.guide_explorer_relationship(guide_explorer_relationship_id),
  summary_type text not null,
  summary_status text not null default 'draft',
  visibility text not null default 'guide_only',
  current_summary_revision_id uuid null,
  source_ai_interaction_session_id uuid null references ai.ai_interaction_session(ai_interaction_session_id),
  source_check_in_id uuid null references content.check_in(check_in_id),
  source_reflection_id uuid null references content.reflection(reflection_id),
  source_safety_flag_id uuid null references content.safety_flag(safety_flag_id),
  source_trigger_observation_id uuid null references content.trigger_observation(trigger_observation_id),
  created_by_actor_type text not null,
  created_by_user_account_id uuid null references identity.user_account(user_account_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'sensitive_content',

  constraint summary_type_check
    check (summary_type in ('guide_prep', 'check_in', 'reflection', 'session', 'safety', 'trigger_pattern', 'general')),

  constraint summary_status_check
    check (summary_status in ('draft', 'ready_for_review', 'approved', 'rejected', 'archived')),

  constraint summary_visibility_check
    check (visibility in ('guide_only', 'admin_qa', 'explorer_visible_after_approval')),

  constraint summary_created_by_actor_type_check
    check (created_by_actor_type in ('solmind_virtual_guide', 'solmind_guide_assistant', 'guide', 'admin')),

  constraint summary_created_by_user_account_check
    check (
      (created_by_actor_type in ('guide', 'admin') and created_by_user_account_id is not null)
      or (created_by_actor_type in ('solmind_virtual_guide', 'solmind_guide_assistant') and created_by_user_account_id is null)
    ),

  constraint summary_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint summary_retention_class_check
    check (retention_class = 'sensitive_content'),

  constraint summary_updated_time_order_check
    check (updated_at is null or updated_at >= created_at)
);

alter table content.summary enable row level security;

create table if not exists content.summary_revision (
  summary_revision_id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references content.summary(summary_id),
  revision_number integer not null,
  summary_text text not null,
  revision_status text not null default 'draft',
  created_by_actor_type text not null,
  created_by_user_account_id uuid null references identity.user_account(user_account_id),
  source_ai_model_invocation_id uuid null references ai.ai_model_invocation(ai_model_invocation_id),
  source_ai_interaction_session_id uuid null references ai.ai_interaction_session(ai_interaction_session_id),
  source_ai_interaction_message_id uuid null references ai.ai_interaction_message(ai_interaction_message_id),
  reviewed_by_user_account_id uuid null references identity.user_account(user_account_id),
  reviewed_at timestamptz null,
  review_note text null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'sensitive_content',

  constraint summary_revision_number_check
    check (revision_number > 0),

  constraint summary_revision_text_not_blank_check
    check (length(trim(summary_text)) > 0),

  constraint summary_revision_status_check
    check (revision_status in ('draft', 'ready_for_review', 'approved', 'rejected', 'superseded', 'archived')),

  constraint summary_revision_created_by_actor_type_check
    check (created_by_actor_type in ('solmind_virtual_guide', 'solmind_guide_assistant', 'guide', 'admin')),

  constraint summary_revision_created_by_user_account_check
    check (
      (created_by_actor_type in ('guide', 'admin') and created_by_user_account_id is not null)
      or (created_by_actor_type in ('solmind_virtual_guide', 'solmind_guide_assistant') and created_by_user_account_id is null)
    ),

  constraint summary_revision_reviewed_consistency_check
    check (
      (reviewed_at is null and reviewed_by_user_account_id is null)
      or (reviewed_at is not null and reviewed_by_user_account_id is not null)
    ),

  constraint summary_revision_review_note_not_blank_check
    check (review_note is null or length(trim(review_note)) > 0),

  constraint summary_revision_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint summary_revision_retention_class_check
    check (retention_class = 'sensitive_content'),

  constraint summary_revision_number_unique
    unique (summary_id, revision_number)
);

alter table content.summary_revision enable row level security;

alter table content.summary
  add constraint summary_current_revision_fk
  foreign key (current_summary_revision_id)
  references content.summary_revision(summary_revision_id);

alter table content.trigger_observation
  add constraint trigger_observation_source_summary_revision_fk
  foreign key (source_summary_revision_id)
  references content.summary_revision(summary_revision_id);

create index if not exists summary_relationship_status_created_idx
  on content.summary (guide_explorer_relationship_id, summary_status, created_at desc);

create index if not exists summary_relationship_type_created_idx
  on content.summary (guide_explorer_relationship_id, summary_type, created_at desc);

create index if not exists summary_visibility_status_created_idx
  on content.summary (visibility, summary_status, created_at desc);

create index if not exists summary_current_revision_idx
  on content.summary (current_summary_revision_id)
  where current_summary_revision_id is not null;

create index if not exists summary_source_ai_session_idx
  on content.summary (source_ai_interaction_session_id)
  where source_ai_interaction_session_id is not null;

create index if not exists summary_source_check_in_idx
  on content.summary (source_check_in_id)
  where source_check_in_id is not null;

create index if not exists summary_source_reflection_idx
  on content.summary (source_reflection_id)
  where source_reflection_id is not null;

create index if not exists summary_source_safety_flag_idx
  on content.summary (source_safety_flag_id)
  where source_safety_flag_id is not null;

create index if not exists summary_source_trigger_observation_idx
  on content.summary (source_trigger_observation_id)
  where source_trigger_observation_id is not null;

create index if not exists summary_revision_summary_number_idx
  on content.summary_revision (summary_id, revision_number desc);

create index if not exists summary_revision_summary_status_created_idx
  on content.summary_revision (summary_id, revision_status, created_at desc);

create index if not exists summary_revision_source_model_invocation_idx
  on content.summary_revision (source_ai_model_invocation_id)
  where source_ai_model_invocation_id is not null;

create index if not exists summary_revision_source_session_idx
  on content.summary_revision (source_ai_interaction_session_id)
  where source_ai_interaction_session_id is not null;

create index if not exists summary_revision_source_message_idx
  on content.summary_revision (source_ai_interaction_message_id)
  where source_ai_interaction_message_id is not null;

create index if not exists summary_revision_reviewed_idx
  on content.summary_revision (reviewed_by_user_account_id, reviewed_at desc)
  where reviewed_by_user_account_id is not null;

comment on table content.summary is
  'Stable summary container scoped to a Guide/Explorer relationship. Summary text lives in content.summary_revision so revisions can be reviewed without overwriting prior text.';

comment on table content.summary_revision is
  'Versioned summary text with AI/manual provenance and Guide/Admin review fields. Sensitive derived Explorer content; must not be duplicated into audit metadata.';

comment on column content.summary.summary_type is
  'MVP0 summary category for Guide prep, check-ins, reflections, sessions, safety, trigger patterns, or general review.';

comment on column content.summary.summary_status is
  'Container lifecycle for the summary. Application logic enforces legal transitions between draft, review, approval, rejection, and archive states.';

comment on column content.summary.visibility is
  'guide_only is the MVP0 default. explorer_visible_after_approval is a future-safe state and must not be used without consent-aware UI and application checks.';

comment on column content.summary.current_summary_revision_id is
  'Optional pointer to the current revision. It is nullable during initial creation or when no revision has been accepted as current.';

comment on column content.summary.source_ai_interaction_session_id is
  'Nullable AI Interaction Session provenance for a generated or assisted summary.';

comment on column content.summary_revision.summary_text is
  'Human-reviewable summary text. This is sensitive derived Explorer content and must not be duplicated into audit metadata.';

comment on column content.summary_revision.source_ai_model_invocation_id is
  'Nullable AI Model Invocation provenance for generated summary text.';

comment on column content.summary_revision.source_ai_interaction_message_id is
  'Nullable AI Interaction Message provenance for the generated or reviewed summary text.';

comment on column content.summary_revision.review_note is
  'Optional reviewer note. Do not store raw Explorer transcript excerpts here unless intentionally needed for human review.';