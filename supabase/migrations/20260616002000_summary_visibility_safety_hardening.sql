-- SolMind MVP0 Summary Visibility Safety Hardening.
-- Purpose:
--   - prevent safety and trigger-pattern summaries from being marked Explorer-visible
--   - preserve deterministic safety boundaries before summary UI or runtime generation exists
--   - harden the Summary Foundation schema after external AI review
--
-- This migration intentionally creates no users, no policies, no grants,
-- no real pilot data, no seed data, no UI, no summary runtime,
-- no Explorer-visible release workflow, no notification delivery,
-- and no storage buckets.

alter table content.summary
  add constraint summary_safety_trigger_visibility_check
  check (
    summary_type not in ('safety', 'trigger_pattern')
    or visibility <> 'explorer_visible_after_approval'
  );

comment on constraint summary_safety_trigger_visibility_check on content.summary is
  'Safety and trigger-pattern summaries must not be marked Explorer-visible. They remain Guide/Admin review content unless a later approved consent-aware workflow explicitly changes the model.';