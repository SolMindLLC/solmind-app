-- SolMind MVP0 AI Model Invocation Foundation.
-- Purpose:
--   - add provider/model invocation metadata records
--   - link model calls to AI Interaction Sessions and response messages when available
--   - support future AI observability, safety review, and cost/token tracking without storing secrets
--
-- This migration intentionally creates no users, no policies, no grants,
-- no real pilot data, no seed data, no UI, no provider integration code,
-- no model calls, no raw prompts, no raw responses, no API keys,
-- no provider secrets, no environment variables, no cost dashboard,
-- and no storage buckets.

create table if not exists ai.ai_model_invocation (
  ai_model_invocation_id uuid primary key default gen_random_uuid(),
  ai_interaction_session_id uuid null references ai.ai_interaction_session(ai_interaction_session_id),
  ai_interaction_message_id uuid null references ai.ai_interaction_message(ai_interaction_message_id),
  provider_name text not null,
  model_name text not null,
  prompt_version text not null,
  request_status text not null default 'started',
  input_token_count integer null,
  output_token_count integer null,
  estimated_cost numeric(12, 6) null,
  safety_result jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  error_summary text null,
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'sensitive_content',

  constraint ai_model_invocation_provider_name_not_blank_check
    check (length(trim(provider_name)) > 0),

  constraint ai_model_invocation_model_name_not_blank_check
    check (length(trim(model_name)) > 0),

  constraint ai_model_invocation_prompt_version_not_blank_check
    check (length(trim(prompt_version)) > 0),

  constraint ai_model_invocation_request_status_check
    check (request_status in ('started', 'completed', 'failed', 'canceled')),

  constraint ai_model_invocation_input_token_count_check
    check (input_token_count is null or input_token_count >= 0),

  constraint ai_model_invocation_output_token_count_check
    check (output_token_count is null or output_token_count >= 0),

  constraint ai_model_invocation_estimated_cost_check
    check (estimated_cost is null or estimated_cost >= 0),

  constraint ai_model_invocation_completed_at_check
    check (
      (request_status in ('completed', 'failed', 'canceled') and completed_at is not null)
      or (request_status = 'started' and completed_at is null)
    ),

  constraint ai_model_invocation_time_order_check
    check (completed_at is null or completed_at >= started_at),

  constraint ai_model_invocation_error_summary_check
    check (
      error_summary is null
      or (
        length(trim(error_summary)) > 0
        and request_status = 'failed'
      )
    ),

  constraint ai_model_invocation_safety_result_object_check
    check (jsonb_typeof(safety_result) = 'object'),

  constraint ai_model_invocation_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint ai_model_invocation_retention_class_check
    check (retention_class = 'sensitive_content')
);

alter table ai.ai_model_invocation enable row level security;

create index if not exists ai_model_invocation_provider_model_started_idx
  on ai.ai_model_invocation (provider_name, model_name, started_at desc);

create index if not exists ai_model_invocation_session_started_idx
  on ai.ai_model_invocation (ai_interaction_session_id, started_at desc)
  where ai_interaction_session_id is not null;

create index if not exists ai_model_invocation_message_idx
  on ai.ai_model_invocation (ai_interaction_message_id)
  where ai_interaction_message_id is not null;

create index if not exists ai_model_invocation_status_started_idx
  on ai.ai_model_invocation (request_status, started_at desc);

comment on table ai.ai_model_invocation is
  'Provider/model call metadata and optional request/response references. This table stores sensitive provenance metadata and must not store raw prompts, raw responses, API keys, provider secrets, or environment variables.';

comment on column ai.ai_model_invocation.ai_interaction_session_id is
  'Nullable AI Interaction Session associated with this model call.';

comment on column ai.ai_model_invocation.ai_interaction_message_id is
  'Nullable response message associated with this model call.';

comment on column ai.ai_model_invocation.provider_name is
  'AI provider or OpenAI-compatible provider name. Not a secret.';

comment on column ai.ai_model_invocation.model_name is
  'Provider model identifier. Not a secret.';

comment on column ai.ai_model_invocation.safety_result is
  'Non-secret provider or application safety metadata. Do not store raw message content here.';

comment on column ai.ai_model_invocation.metadata is
  'Provider response IDs or non-secret operational metadata only. Never store API keys, provider secrets, environment variables, raw prompts, or raw responses.';