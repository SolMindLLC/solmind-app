-- SolMind MVP0 Reflection Foundation.
-- Purpose:
--   - create content schema for MVP0 reflection and future content data
--   - add immutable-ish Reflection records for the Reflective Confirmation Loop
--   - support confirmed-only Explorer-facing AI continuity context
--
-- This migration intentionally creates no users, no policies, no grants,
-- no real pilot data, no seed data, no UI, no reflection extraction agent,
-- no prompt assembly runtime, no waypoint/summary/safety tables,
-- and no storage buckets.

create schema if not exists content;

create table if not exists content.reflection (
  reflection_id uuid primary key default gen_random_uuid(),
  guide_explorer_relationship_id uuid not null references core.guide_explorer_relationship(guide_explorer_relationship_id),
  reflection_text text not null,
  confirmation_status text not null default 'proposed',
  confidence_level text not null default 'medium',
  proposed_by_actor_type text not null,
  proposed_by_user_account_id uuid null references identity.user_account(user_account_id),
  source_ai_interaction_session_id uuid not null references ai.ai_interaction_session(ai_interaction_session_id),
  source_ai_interaction_message_id uuid null references ai.ai_interaction_message(ai_interaction_message_id),
  confirmation_source_message_id uuid null references ai.ai_interaction_message(ai_interaction_message_id),
  confirmed_at timestamptz null,
  confirmed_by_user_account_id uuid null references identity.user_account(user_account_id),
  rejected_at timestamptz null,
  refined_from_reflection_id uuid null references content.reflection(reflection_id),
  superseded_at timestamptz null,
  visibility text not null default 'explorer_and_guide',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'sensitive_content',

  constraint reflection_text_not_blank_check
    check (length(trim(reflection_text)) > 0),

  constraint reflection_confirmation_status_check
    check (confirmation_status in ('proposed', 'confirmed', 'rejected', 'superseded', 'archived')),

  constraint reflection_confidence_level_check
    check (confidence_level in ('low', 'medium', 'high')),

  constraint reflection_proposed_by_actor_type_check
    check (proposed_by_actor_type in ('solmind_virtual_guide', 'solmind_guide_assistant', 'guide', 'explorer')),

  constraint reflection_visibility_check
    check (visibility in ('explorer_and_guide', 'paused_from_ai_context')),

  constraint reflection_retention_class_check
    check (retention_class = 'sensitive_content'),

  constraint reflection_proposed_by_user_account_check
    check (
      (proposed_by_actor_type in ('guide', 'explorer') and proposed_by_user_account_id is not null)
      or (proposed_by_actor_type in ('solmind_virtual_guide', 'solmind_guide_assistant') and proposed_by_user_account_id is null)
    ),

  constraint reflection_confirmed_fields_check
    check (
      (confirmation_status = 'confirmed' and confirmed_at is not null and confirmed_by_user_account_id is not null)
      or (confirmation_status <> 'confirmed')
    ),

  constraint reflection_rejected_fields_check
    check (
      (confirmation_status = 'rejected' and rejected_at is not null)
      or (confirmation_status <> 'rejected')
    ),

  constraint reflection_superseded_fields_check
    check (
      (confirmation_status = 'superseded' and superseded_at is not null)
      or (confirmation_status <> 'superseded')
    ),

  constraint reflection_paused_visibility_confirmed_check
    check (
      visibility = 'explorer_and_guide'
      or confirmation_status = 'confirmed'
    ),

  constraint reflection_no_self_refinement_check
    check (refined_from_reflection_id is null or refined_from_reflection_id <> reflection_id)
);

alter table content.reflection enable row level security;

create index if not exists reflection_relationship_status_created_idx
  on content.reflection (guide_explorer_relationship_id, confirmation_status, created_at desc);

create index if not exists reflection_confirmed_context_idx
  on content.reflection (guide_explorer_relationship_id)
  where confirmation_status = 'confirmed' and visibility = 'explorer_and_guide';

create index if not exists reflection_source_session_idx
  on content.reflection (source_ai_interaction_session_id);

create index if not exists reflection_source_message_idx
  on content.reflection (source_ai_interaction_message_id)
  where source_ai_interaction_message_id is not null;

create index if not exists reflection_confirmation_source_message_idx
  on content.reflection (confirmation_source_message_id)
  where confirmation_source_message_id is not null;

create index if not exists reflection_refined_from_idx
  on content.reflection (refined_from_reflection_id)
  where refined_from_reflection_id is not null;

comment on schema content is 'SolMind MVP0 reflection, summary, waypoint, note, check-in, and safety content.';

comment on table content.reflection is
  'Immutable-ish candidate/confirmed statements forming the Reflective Confirmation Loop record. Reflection text is not updated after insert; lifecycle fields carry confirmation, rejection, supersession, archive, and visibility state.';

comment on column content.reflection.reflection_text is
  'The proposed or refined reflection statement. This is derived emotional content and must not be duplicated into audit metadata.';

comment on column content.reflection.confirmation_status is
  'Lifecycle state. Legal transitions are enforced in the application layer; database constraints enforce value shape and required transition fields.';

comment on column content.reflection.visibility is
  'explorer_and_guide means eligible for Explorer-facing continuity only when confirmed. paused_from_ai_context marks a confirmed reflection temporarily excluded from Explorer-facing AI prompt assembly but not hidden from the Explorer.';

comment on column content.reflection.source_ai_interaction_session_id is
  'AI Interaction Session in which this reflection row was proposed or refined.';

comment on column content.reflection.source_ai_interaction_message_id is
  'Nullable AI message containing the reflection proposal, where identifiable.';

comment on column content.reflection.confirmation_source_message_id is
  'Nullable Explorer message expressing confirmation, refinement, or rejection.';

comment on column content.reflection.refined_from_reflection_id is
  'Nullable predecessor reflection in a refinement chain. Creating a refinement row should supersede the predecessor in the same application transaction.';