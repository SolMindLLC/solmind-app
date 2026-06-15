-- SolMind MVP0 intake response foundation.
-- Purpose:
--   - add Explorer intake response completion records
--   - preserve relationship context for intake/onboarding workflow
--   - allow MVP0 flexible intake payloads while normalized responses are deferred
--
-- This migration intentionally creates no users, no policies, no grants,
-- no real pilot data, no seed data, no UI, no questionnaire definition tables,
-- no normalized response item tables, no appointment scheduling changes, and no storage buckets.

create table if not exists core.intake_response_set (
  intake_response_set_id uuid primary key default gen_random_uuid(),
  guide_explorer_relationship_id uuid not null references core.guide_explorer_relationship(guide_explorer_relationship_id),
  started_at timestamptz null,
  completed_at timestamptz null,
  intake_status text not null default 'not_started',
  response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'sensitive_content',

  constraint intake_response_set_status_check
    check (intake_status in ('not_started', 'in_progress', 'completed', 'abandoned', 'reopened')),

  constraint intake_response_set_retention_class_check
    check (retention_class = 'sensitive_content'),

  constraint intake_response_set_started_at_check
    check (
      (intake_status in ('in_progress', 'completed', 'abandoned', 'reopened') and started_at is not null)
      or
      (intake_status = 'not_started')
    ),

  constraint intake_response_set_completed_at_check
    check (
      (intake_status = 'completed' and completed_at is not null)
      or
      (intake_status <> 'completed')
    )
);

alter table core.intake_response_set enable row level security;

create index if not exists intake_response_set_relationship_status_idx
  on core.intake_response_set (guide_explorer_relationship_id, intake_status);

create index if not exists intake_response_set_relationship_created_idx
  on core.intake_response_set (guide_explorer_relationship_id, created_at desc);

create index if not exists intake_response_set_completed_idx
  on core.intake_response_set (completed_at desc)
  where intake_status = 'completed';

comment on table core.intake_response_set is
  'Explorer intake completion instance for a Guide-Explorer relationship.';

comment on column core.intake_response_set.response_json is
  'MVP0 flexible intake response payload. Future versions may normalize individual questions and responses.';
