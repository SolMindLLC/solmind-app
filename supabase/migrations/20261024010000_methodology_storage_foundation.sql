-- SolMind MVP0 dormant methodology storage foundation.
-- Purpose:
--   - retain logical methodology scopes and immutable version content/provenance
--   - retain separately controlled screening/Admin/Guide evidence linkage
--   - deny direct API-role access; add only the internal immutability trigger
-- Sources: solmind-docs/canonical/09_SolMind_MethodologyGovernance_v1_0.md;
-- solmind-docs/execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md sections18/24.5/29.4;
-- solmind-docs/execution/04_SolMind_AI_Orchestration_Spec_v1_0.md section9.
-- This migration creates no users, seed, approved/active pack data, policies,
-- direct table/schema/function grants, callable workflow RPC, source upload,
-- UI, provider call, runtime activation or historical snapshot FK/backfill.
-- Operational screen, focused Admin review, actual Guide-role approval, audit
-- semantics and effective-version resolution remain deliberately unimplemented.
-- A schema/row/FK alone supplies none of those authorities.

-- Fail on an unexpected existing schema rather than merge unknown definitions.
create schema methodology;
revoke all on schema methodology from public, anon, authenticated, service_role;

create table methodology.methodology_context_pack (
  methodology_context_pack_id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('organization', 'practice', 'guide')),
  organization_id uuid null references core.organization(organization_id),
  practice_id uuid null references core.practice(practice_id),
  guide_profile_id uuid null references core.guide_profile(guide_profile_id),
  scope_id uuid generated always as
    (coalesce(organization_id, practice_id, guide_profile_id)) stored,
  pack_name text not null check (length(btrim(pack_name)) > 0),
  pack_status text not null default 'draft'
    check (pack_status in ('draft', 'active', 'inactive', 'archived')),
  active_version_id uuid null,
  created_at timestamptz not null default now(),
  created_by_user_account_id uuid null references identity.user_account(user_account_id),
  created_by_role_context text not null
    check (created_by_role_context in ('admin', 'guide', 'system')),
  retention_class text not null default 'core_business'
    check (retention_class = 'core_business'),
  constraint methodology_pack_exact_scope_check check (
    (scope_type = 'organization' and organization_id is not null
      and practice_id is null and guide_profile_id is null)
    or (scope_type = 'practice' and practice_id is not null
      and organization_id is null and guide_profile_id is null)
    or (scope_type = 'guide' and guide_profile_id is not null
      and organization_id is null and practice_id is null)
  ),
  constraint methodology_pack_creator_presence_check check (
    (created_by_role_context = 'system' and created_by_user_account_id is null)
    or (created_by_role_context in ('admin', 'guide')
      and created_by_user_account_id is not null)
  ),
  constraint methodology_pack_active_pointer_check check (
    pack_status <> 'active' or active_version_id is not null
  )
);
alter table methodology.methodology_context_pack enable row level security;
revoke all on methodology.methodology_context_pack
  from public, anon, authenticated, service_role;

create table methodology.methodology_context_pack_version (
  methodology_context_pack_version_id uuid primary key default gen_random_uuid(),
  methodology_context_pack_id uuid not null references
    methodology.methodology_context_pack(methodology_context_pack_id),
  version_number integer not null check (version_number > 0),
  previous_version_id uuid null,
  content_markdown text not null check (length(btrim(content_markdown)) > 0),
  content_sha256 text not null,
  created_by_actor_type text not null check (created_by_actor_type in
    ('admin', 'guide', 'solmind_guide_assistant', 'system_migration')),
  created_by_user_account_id uuid null references identity.user_account(user_account_id),
  created_by_role_context text not null
    check (created_by_role_context in ('admin', 'guide', 'system')),
  source_type text not null check (source_type in
    ('manual_entry', 'admin_assisted', 'guide_edited', 'ai_generated',
     'solmind_guide_assistant_edited', 'imported_from_source_material', 'system_migration')),
  source_actor_label text not null check (length(btrim(source_actor_label)) > 0),
  source_provenance jsonb not null check
    (jsonb_typeof(source_provenance) = 'array' and jsonb_array_length(source_provenance) > 0),
  ai_change_summary text not null check (length(btrim(ai_change_summary)) > 0),
  created_at timestamptz not null default now(),
  approval_status text not null default 'draft' check (approval_status in
    ('draft', 'needs_guide_review', 'guide_approved', 'rejected', 'superseded')),
  safety_screen_result text null check (safety_screen_result in ('pass', 'review', 'fail')),
  safety_screen_invocation_id uuid null references ai.ai_model_invocation(ai_model_invocation_id),
  safety_screen_audit_event_id uuid null references audit.audit_event(audit_event_id),
  safety_screen_completed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb check
    (jsonb_typeof(metadata) = 'object' and metadata - 'safety_screen' = '{}'::jsonb),
  admin_consistency_reviewer_user_account_id uuid null
    references identity.user_account(user_account_id),
  admin_consistency_user_session_id uuid null references identity.user_session(user_session_id),
  admin_consistency_audit_event_id uuid null references audit.audit_event(audit_event_id),
  admin_consistency_reviewed_at timestamptz null,
  approved_by_user_account_id uuid null references identity.user_account(user_account_id),
  approved_by_role_context text null check (approved_by_role_context = 'guide'),
  approved_by_user_session_id uuid null references identity.user_session(user_session_id),
  guide_checklist_affirmed boolean not null default false,
  guide_approval_audit_event_id uuid null references audit.audit_event(audit_event_id),
  approved_at timestamptz null,
  active_from timestamptz null,
  superseded_at timestamptz null,
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),
  unique (methodology_context_pack_id, version_number),
  unique (methodology_context_pack_id, methodology_context_pack_version_id),
  foreign key (methodology_context_pack_id, previous_version_id) references
    methodology.methodology_context_pack_version
      (methodology_context_pack_id, methodology_context_pack_version_id),
  constraint methodology_version_predecessor_shape_check check (
    (version_number = 1 and previous_version_id is null)
    or (version_number > 1 and previous_version_id is not null
      and previous_version_id <> methodology_context_pack_version_id)
  ),
  constraint methodology_version_exact_content_digest_check check (
    content_sha256 ~ '^[0-9A-F]{64}$' and content_sha256 =
      upper(encode(extensions.digest(convert_to(content_markdown, 'UTF8'), 'sha256'), 'hex'))
  ),
  constraint methodology_version_human_creator_check check (
    created_by_actor_type not in ('admin', 'guide')
    or (created_by_user_account_id is not null
      and created_by_role_context = created_by_actor_type)
  ),
  constraint methodology_version_screen_shape_check check (
    (safety_screen_result is null and safety_screen_invocation_id is null
      and safety_screen_audit_event_id is null and safety_screen_completed_at is null
      and metadata = '{}'::jsonb)
    or (safety_screen_result is not null and safety_screen_invocation_id is not null
      and safety_screen_audit_event_id is not null and safety_screen_completed_at is not null
      and safety_screen_completed_at >= created_at
      and jsonb_typeof(metadata -> 'safety_screen') is not distinct from 'object'
      and metadata -> 'safety_screen' ->> 'result' is not distinct from safety_screen_result
      and metadata -> 'safety_screen' ->> 'screen_invocation_id'
        is not distinct from safety_screen_invocation_id::text
      and metadata -> 'safety_screen' ->> 'content_sha256' is not distinct from content_sha256
      and jsonb_typeof(metadata -> 'safety_screen' -> 'cited_excerpts')
        is not distinct from 'array')
  ),
  constraint methodology_version_admin_evidence_shape_check check (
    (admin_consistency_reviewed_at is null and admin_consistency_reviewer_user_account_id is null
      and admin_consistency_user_session_id is null and admin_consistency_audit_event_id is null)
    or (admin_consistency_reviewed_at is not null
      and admin_consistency_reviewer_user_account_id is not null
      and admin_consistency_user_session_id is not null and admin_consistency_audit_event_id is not null
      and admin_consistency_reviewed_at >= created_at)
  ),
  constraint methodology_version_guide_evidence_shape_check check (
    (approval_status in ('draft', 'needs_guide_review', 'rejected')
      and approved_by_user_account_id is null and approved_by_role_context is null
      and approved_by_user_session_id is null and guide_approval_audit_event_id is null
      and approved_at is null and guide_checklist_affirmed = false)
    or (approval_status in ('guide_approved', 'superseded')
      and approved_by_user_account_id is not null and approved_by_role_context is not distinct from 'guide'
      and approved_by_user_session_id is not null and guide_approval_audit_event_id is not null
      and approved_at is not null and guide_checklist_affirmed = true
      and safety_screen_result in ('pass', 'review') and safety_screen_completed_at is not null
      and admin_consistency_reviewed_at is not null
      and approved_at >= safety_screen_completed_at and approved_at >= admin_consistency_reviewed_at)
  ),
  constraint methodology_version_activation_time_shape_check check (
    (active_from is null or (approved_at is not null and active_from >= approved_at))
    and (superseded_at is null or (approval_status = 'superseded'
      and approved_at is not null and superseded_at >= approved_at
      and (active_from is null or superseded_at >= active_from)))
  )
);
alter table methodology.methodology_context_pack_version enable row level security;
revoke all on methodology.methodology_context_pack_version
  from public, anon, authenticated, service_role;

-- The composite pointer cannot select a version belonging to a different pack.
-- Guide approval, scope authority and effective-time checks still need the
-- closed, audited workflow functions described in the notes; none exist here.
alter table methodology.methodology_context_pack add constraint methodology_pack_own_version_fk
  foreign key (methodology_context_pack_id, active_version_id) references
    methodology.methodology_context_pack_version
      (methodology_context_pack_id, methodology_context_pack_version_id);

create unique index methodology_pack_one_active_guide_practice_scope_idx
  on methodology.methodology_context_pack (scope_type, scope_id)
  where pack_status = 'active' and scope_type in ('guide', 'practice');
create index methodology_pack_scope_status_idx
  on methodology.methodology_context_pack (scope_type, scope_id, pack_status);
create index methodology_version_pack_status_number_idx
  on methodology.methodology_context_pack_version
    (methodology_context_pack_id, approval_status, version_number desc);

-- Internal trigger only: no workflow, authorization, approval or audit RPC.
-- Exact content, origin and creation identity cannot be edited. Completed
-- screen/Admin/Guide evidence cannot be rewritten; changed text needs a new row.
create function methodology.guard_methodology_version_immutability()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'solmind_methodology_version_immutable';
  end if;
  if (to_jsonb(NEW) - array['approval_status', 'safety_screen_result',
      'safety_screen_invocation_id', 'safety_screen_audit_event_id',
      'safety_screen_completed_at', 'metadata', 'admin_consistency_reviewer_user_account_id',
      'admin_consistency_user_session_id', 'admin_consistency_audit_event_id',
      'admin_consistency_reviewed_at', 'approved_by_user_account_id',
      'approved_by_role_context', 'approved_by_user_session_id', 'guide_checklist_affirmed',
      'guide_approval_audit_event_id', 'approved_at', 'active_from', 'superseded_at']::text[])
    is distinct from
    (to_jsonb(OLD) - array['approval_status', 'safety_screen_result',
      'safety_screen_invocation_id', 'safety_screen_audit_event_id',
      'safety_screen_completed_at', 'metadata', 'admin_consistency_reviewer_user_account_id',
      'admin_consistency_user_session_id', 'admin_consistency_audit_event_id',
      'admin_consistency_reviewed_at', 'approved_by_user_account_id',
      'approved_by_role_context', 'approved_by_user_session_id', 'guide_checklist_affirmed',
      'guide_approval_audit_event_id', 'approved_at', 'active_from', 'superseded_at']::text[]) then
    raise exception 'solmind_methodology_version_immutable';
  end if;
  if OLD.safety_screen_completed_at is not null and
    row(NEW.safety_screen_result, NEW.safety_screen_invocation_id,
      NEW.safety_screen_audit_event_id, NEW.safety_screen_completed_at, NEW.metadata)
    is distinct from row(OLD.safety_screen_result, OLD.safety_screen_invocation_id,
      OLD.safety_screen_audit_event_id, OLD.safety_screen_completed_at, OLD.metadata) then
    raise exception 'solmind_methodology_screen_immutable';
  end if;
  if OLD.admin_consistency_reviewed_at is not null and
    row(NEW.admin_consistency_reviewer_user_account_id, NEW.admin_consistency_user_session_id,
      NEW.admin_consistency_audit_event_id, NEW.admin_consistency_reviewed_at)
    is distinct from row(OLD.admin_consistency_reviewer_user_account_id, OLD.admin_consistency_user_session_id,
      OLD.admin_consistency_audit_event_id, OLD.admin_consistency_reviewed_at) then
    raise exception 'solmind_methodology_admin_evidence_immutable';
  end if;
  if OLD.approved_at is not null and
    row(NEW.approved_by_user_account_id, NEW.approved_by_role_context, NEW.approved_by_user_session_id,
      NEW.guide_checklist_affirmed, NEW.guide_approval_audit_event_id, NEW.approved_at)
    is distinct from row(OLD.approved_by_user_account_id, OLD.approved_by_role_context,
      OLD.approved_by_user_session_id, OLD.guide_checklist_affirmed,
      OLD.guide_approval_audit_event_id, OLD.approved_at) then
    raise exception 'solmind_methodology_guide_evidence_immutable';
  end if;
  if (OLD.active_from is not null and NEW.active_from is distinct from OLD.active_from)
    or (OLD.superseded_at is not null and NEW.superseded_at is distinct from OLD.superseded_at) then
    raise exception 'solmind_methodology_effective_time_immutable';
  end if;
  return NEW;
end;
$$;
revoke all on function methodology.guard_methodology_version_immutability()
  from public, anon, authenticated, service_role;
create trigger methodology_version_immutable_content
  before update or delete on methodology.methodology_context_pack_version
  for each row execute function methodology.guard_methodology_version_immutability();

comment on table methodology.methodology_context_pack is
  'Dormant methodology logical scope; no operational review, approval or activation access path.';
comment on table methodology.methodology_context_pack_version is
  'Dormant methodology content/provenance and controlled workflow evidence; SQL structure is not proof of screening, human role authority or audit semantics.';
comment on column methodology.methodology_context_pack_version.metadata is
  'Dormant safety_screen evidence: result, screen_invocation_id, exact content_sha256 and cited_excerpts. No Explorer data, provider secrets or raw provider response.';

-- Required default-privilege protection is the explicit object revocation above.
-- Per-schema ALTER DEFAULT PRIVILEGES cannot undo a globally granted default;
-- future migrations must recheck effective privileges for every actual owner.
-- No policies, service-role DML grants, callable workflow functions or seed exist.
-- No ai_context_snapshot FK/backfill/rewriting is made by this migration.
