-- SolMind MVP0 Summary Publication and Shared Snapshot Realignment.
-- Parent traceability: PRJ01_R-WS09-WI021-S02.
--
-- Forward-only correction of the dormant June Summary foundation. The two
-- historical June migrations remain immutable. This migration deliberately
-- fails if either historical table contains rows; a populated environment
-- requires a separately reviewed data-preserving migration instead of silent
-- reinterpretation.
--
-- This migration adds no users, real data, RLS policies, browser route,
-- provider call, notification delivery, storage bucket, or application caller.

do $$
begin
  if exists (select 1 from content.summary limit 1)
     or exists (select 1 from content.summary_revision limit 1)
  then
    raise exception 'solmind_summary_realign_nonempty_precondition';
  end if;
end;
$$;

-- Retire stale June indexes and constraints before changing vocabulary.
drop index if exists content.summary_visibility_status_created_idx;
drop index if exists content.summary_relationship_type_created_idx;
drop index if exists content.summary_relationship_status_created_idx;
drop index if exists content.summary_current_revision_idx;
drop index if exists content.summary_source_ai_session_idx;
drop index if exists content.summary_source_check_in_idx;
drop index if exists content.summary_source_reflection_idx;
drop index if exists content.summary_source_safety_flag_idx;
drop index if exists content.summary_source_trigger_observation_idx;
drop index if exists content.summary_revision_summary_status_created_idx;

alter table content.summary
  drop constraint summary_current_revision_fk,
  drop constraint summary_safety_trigger_visibility_check,
  drop constraint summary_type_check,
  drop constraint summary_status_check,
  drop constraint summary_visibility_check,
  drop constraint summary_created_by_actor_type_check,
  drop constraint summary_created_by_user_account_check;

alter table content.summary_revision
  drop constraint summary_revision_status_check,
  drop constraint summary_revision_created_by_actor_type_check,
  drop constraint summary_revision_created_by_user_account_check,
  drop constraint summary_revision_text_not_blank_check,
  drop constraint summary_revision_reviewed_consistency_check,
  drop constraint summary_revision_review_note_not_blank_check;

alter table content.summary
  rename column current_summary_revision_id to current_revision_id;

alter table content.summary
  rename column source_ai_interaction_session_id
  to created_from_ai_interaction_session_id;

alter table content.summary_revision
  rename column summary_text to content_markdown;

alter table content.summary
  drop column visibility,
  drop column source_check_in_id,
  drop column source_reflection_id,
  drop column source_safety_flag_id,
  drop column source_trigger_observation_id,
  add column created_from_appointment_id uuid null
    references scheduling.appointment(appointment_id),
  add column version bigint not null default 1,
  add column last_operation_id uuid null,
  add constraint summary_type_check
    check (
      summary_type in (
        'guide_summary',
        'pre_session_summary',
        'explorer_facing_summary'
      )
    ),
  add constraint summary_status_check
    check (
      summary_status in (
        'draft',
        'in_review',
        'approved',
        'published',
        'archived'
      )
    ),
  add constraint summary_created_by_actor_type_check
    check (
      created_by_actor_type in (
        'guide',
        'solmind_guide_assistant',
        'system'
      )
    ),
  add constraint summary_created_by_user_account_check
    check (
      (
        created_by_actor_type = 'guide'
        and created_by_user_account_id is not null
      )
      or
      (
        created_by_actor_type in ('solmind_guide_assistant', 'system')
        and created_by_user_account_id is null
      )
    ),
  add constraint summary_version_check
    check (version > 0),
  add constraint summary_current_revision_fk
    foreign key (current_revision_id)
    references content.summary_revision(summary_revision_id);

alter table content.summary_revision
  drop column reviewed_by_user_account_id,
  drop column reviewed_at,
  drop column review_note,
  add column created_by_role_context text not null default 'guide',
  add column previous_revision_id uuid null
    references content.summary_revision(summary_revision_id),
  add column ai_change_summary text null,
  add constraint summary_revision_content_not_blank_check
    check (length(trim(content_markdown)) > 0),
  add constraint summary_revision_status_check
    check (
      revision_status in (
        'ai_generated',
        'guide_edited',
        'ai_edited',
        'guide_approved',
        'published_to_explorer',
        'superseded'
      )
    ),
  add constraint summary_revision_created_by_actor_type_check
    check (
      created_by_actor_type in (
        'guide',
        'solmind_guide_assistant',
        'system'
      )
    ),
  add constraint summary_revision_created_by_role_context_check
    check (created_by_role_context in ('guide', 'system')),
  add constraint summary_revision_created_by_user_account_check
    check (
      (
        created_by_actor_type = 'guide'
        and created_by_role_context = 'guide'
        and created_by_user_account_id is not null
      )
      or
      (
        created_by_actor_type in ('solmind_guide_assistant', 'system')
        and created_by_role_context = 'system'
        and created_by_user_account_id is null
      )
    ),
  add constraint summary_revision_previous_not_self_check
    check (
      previous_revision_id is null
      or previous_revision_id <> summary_revision_id
    ),
  add constraint summary_revision_ai_change_summary_not_blank_check
    check (
      ai_change_summary is null
      or length(trim(ai_change_summary)) > 0
    );

alter table content.summary_revision
  alter column created_by_role_context drop default,
  alter column revision_status set default 'ai_generated';

create unique index summary_last_operation_unique_idx
  on content.summary (last_operation_id)
  where last_operation_id is not null;

create index summary_relationship_status_created_idx
  on content.summary (
    guide_explorer_relationship_id,
    summary_status,
    created_at desc
  );

create index summary_relationship_type_created_idx
  on content.summary (
    guide_explorer_relationship_id,
    summary_type,
    created_at desc
  );

create index summary_current_revision_idx
  on content.summary (current_revision_id)
  where current_revision_id is not null;

create index summary_created_from_ai_session_idx
  on content.summary (created_from_ai_interaction_session_id)
  where created_from_ai_interaction_session_id is not null;

create index summary_created_from_appointment_idx
  on content.summary (created_from_appointment_id)
  where created_from_appointment_id is not null;

create index summary_revision_summary_status_created_idx
  on content.summary_revision (
    summary_id,
    revision_status,
    created_at desc
  );

create index summary_revision_previous_idx
  on content.summary_revision (previous_revision_id)
  where previous_revision_id is not null;

create table content.summary_section (
  summary_section_id uuid primary key default gen_random_uuid(),
  summary_revision_id uuid not null
    references content.summary_revision(summary_revision_id),
  section_type text not null,
  section_title text not null,
  content_markdown text not null,
  visibility text not null default 'guide_only',
  display_order integer not null,
  created_at timestamptz not null default now(),
  retention_class text not null default 'sensitive_content',

  constraint summary_section_type_check
    check (
      section_type in (
        'explorer_facing',
        'guide_only',
        'sensitive_observation',
        'trigger_observation',
        'safety_review'
      )
    ),
  constraint summary_section_visibility_check
    check (
      visibility in (
        'guide_only',
        'explorer_publishable',
        'published_to_explorer'
      )
    ),
  constraint summary_section_type_visibility_pair_check
    check (
      (
        section_type = 'explorer_facing'
        and visibility in (
          'guide_only',
          'explorer_publishable',
          'published_to_explorer'
        )
      )
      or
      (
        section_type in (
          'guide_only',
          'sensitive_observation',
          'trigger_observation',
          'safety_review'
        )
        and visibility = 'guide_only'
      )
    ),
  constraint summary_section_title_not_blank_check
    check (length(trim(section_title)) > 0),
  constraint summary_section_content_not_blank_check
    check (length(trim(content_markdown)) > 0),
  constraint summary_section_display_order_check
    check (display_order > 0),
  constraint summary_section_retention_class_check
    check (retention_class = 'sensitive_content'),
  constraint summary_section_revision_order_unique
    unique (summary_revision_id, display_order)
);

alter table content.summary_section enable row level security;

create index summary_section_revision_visibility_order_idx
  on content.summary_section (
    summary_revision_id,
    visibility,
    display_order
  );

create table content.summary_publication (
  summary_publication_id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references content.summary(summary_id),
  summary_revision_id uuid not null
    references content.summary_revision(summary_revision_id),
  published_to_explorer_profile_id uuid not null
    references core.explorer_profile(explorer_profile_id),
  published_by_user_account_id uuid not null
    references identity.user_account(user_account_id),
  published_by_role_context text not null default 'guide',
  published_at timestamptz not null default now(),
  publication_status text not null default 'published',
  unpublished_at timestamptz null,
  unpublished_by_user_account_id uuid null
    references identity.user_account(user_account_id),
  superseded_by_summary_publication_id uuid null
    references content.summary_publication(summary_publication_id),
  publication_operation_id uuid not null,
  last_operation_id uuid not null,
  created_at timestamptz not null default now(),
  retention_class text not null default 'sensitive_content',

  constraint summary_publication_role_check
    check (published_by_role_context = 'guide'),
  constraint summary_publication_status_check
    check (
      publication_status in ('published', 'unpublished', 'superseded')
    ),
  constraint summary_publication_end_fields_check
    check (
      (
        publication_status = 'published'
        and unpublished_at is null
        and unpublished_by_user_account_id is null
      )
      or
      (
        publication_status in ('unpublished', 'superseded')
        and unpublished_at is not null
        and unpublished_by_user_account_id is not null
      )
    ),
  constraint summary_publication_supersession_not_self_check
    check (
      superseded_by_summary_publication_id is null
      or superseded_by_summary_publication_id <> summary_publication_id
    ),
  constraint summary_publication_retention_class_check
    check (retention_class = 'sensitive_content'),
  constraint summary_publication_operation_unique
    unique (publication_operation_id),
  constraint summary_publication_last_operation_unique
    unique (last_operation_id)
);

alter table content.summary_publication enable row level security;

create unique index summary_publication_one_active_target_idx
  on content.summary_publication (
    summary_id,
    published_to_explorer_profile_id
  )
  where publication_status = 'published';

create index summary_publication_target_status_published_idx
  on content.summary_publication (
    published_to_explorer_profile_id,
    publication_status,
    published_at desc
  );

create index summary_publication_revision_status_idx
  on content.summary_publication (
    summary_revision_id,
    publication_status
  );

create table content.private_summary_draft (
  private_summary_draft_id uuid primary key default gen_random_uuid(),
  guide_explorer_relationship_id uuid not null
    references core.guide_explorer_relationship(
      guide_explorer_relationship_id
    ),
  explorer_profile_id uuid not null
    references core.explorer_profile(explorer_profile_id),
  source_ai_interaction_session_id uuid null
    references ai.ai_interaction_session(ai_interaction_session_id),
  source_waypoint_id uuid null,
  waypoint_reached_at timestamptz not null,
  sendability_days_applied integer not null default 7,
  sendable_until timestamptz not null,
  draft_status text not null default 'reviewable',
  version bigint not null default 1,
  last_operation_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  retention_class text not null default 'sensitive_content',

  constraint private_summary_draft_status_check
    check (
      draft_status in (
        'reviewable',
        'not_ready',
        'confirmed',
        'expired_not_sent',
        'superseded'
      )
    ),
  constraint private_summary_draft_sendability_days_check
    check (sendability_days_applied between 1 and 100),
  constraint private_summary_draft_window_check
    check (
      sendable_until =
      waypoint_reached_at + make_interval(days => sendability_days_applied)
    ),
  constraint private_summary_draft_version_check
    check (version > 0),
  constraint private_summary_draft_updated_order_check
    check (updated_at is null or updated_at >= created_at),
  constraint private_summary_draft_retention_class_check
    check (retention_class = 'sensitive_content')
);

alter table content.private_summary_draft enable row level security;

create unique index private_summary_draft_last_operation_unique_idx
  on content.private_summary_draft (last_operation_id)
  where last_operation_id is not null;

create index private_summary_draft_explorer_status_created_idx
  on content.private_summary_draft (
    explorer_profile_id,
    draft_status,
    created_at desc
  );

create index private_summary_draft_relationship_status_created_idx
  on content.private_summary_draft (
    guide_explorer_relationship_id,
    draft_status,
    created_at desc
  );

create table content.private_summary_draft_item (
  private_summary_draft_item_id uuid primary key default gen_random_uuid(),
  private_summary_draft_id uuid not null
    references content.private_summary_draft(private_summary_draft_id),
  item_type text not null,
  source_type text not null,
  source_entity_id uuid null,
  source_locator text null,
  content_markdown text not null,
  selection_state text not null default 'candidate',
  display_order integer not null,
  created_at timestamptz not null default now(),
  retention_class text not null default 'sensitive_content',

  constraint private_summary_draft_item_type_check
    check (
      item_type in (
        'main_point',
        'supporting_detail',
        'quote',
        'question'
      )
    ),
  constraint private_summary_draft_item_source_type_check
    check (
      source_type in (
        'ai_interaction_message',
        'reflection',
        'waypoint',
        'explorer_authored'
      )
    ),
  constraint private_summary_draft_item_selection_check
    check (selection_state in ('candidate', 'included', 'excluded')),
  constraint private_summary_draft_item_content_not_blank_check
    check (length(trim(content_markdown)) > 0),
  constraint private_summary_draft_item_locator_not_blank_check
    check (source_locator is null or length(trim(source_locator)) > 0),
  constraint private_summary_draft_item_order_check
    check (display_order > 0),
  constraint private_summary_draft_item_retention_class_check
    check (retention_class = 'sensitive_content'),
  constraint private_summary_draft_item_order_unique
    unique (private_summary_draft_id, display_order)
);

alter table content.private_summary_draft_item enable row level security;

create index private_summary_draft_item_draft_selection_order_idx
  on content.private_summary_draft_item (
    private_summary_draft_id,
    selection_state,
    display_order
  );

create table content.shared_snapshot (
  shared_snapshot_id uuid primary key default gen_random_uuid(),
  source_private_summary_draft_id uuid not null
    references content.private_summary_draft(private_summary_draft_id),
  guide_explorer_relationship_id uuid not null
    references core.guide_explorer_relationship(
      guide_explorer_relationship_id
    ),
  explorer_profile_id uuid not null
    references core.explorer_profile(explorer_profile_id),
  source_ai_interaction_session_id uuid null
    references ai.ai_interaction_session(ai_interaction_session_id),
  source_waypoint_id uuid null,
  lineage_type text not null default 'original',
  predecessor_shared_snapshot_id uuid null
    references content.shared_snapshot(shared_snapshot_id),
  confirmed_by_user_account_id uuid not null
    references identity.user_account(user_account_id),
  confirmed_at timestamptz not null default now(),
  confirmation_operation_id uuid not null,
  snapshot_sha256 text not null,
  retention_class text not null default 'sensitive_content',

  constraint shared_snapshot_lineage_type_check
    check (lineage_type in ('original', 'addendum', 'replacement')),
  constraint shared_snapshot_lineage_pair_check
    check (
      (
        lineage_type = 'original'
        and predecessor_shared_snapshot_id is null
      )
      or
      (
        lineage_type in ('addendum', 'replacement')
        and predecessor_shared_snapshot_id is not null
      )
    ),
  constraint shared_snapshot_predecessor_not_self_check
    check (
      predecessor_shared_snapshot_id is null
      or predecessor_shared_snapshot_id <> shared_snapshot_id
    ),
  constraint shared_snapshot_hash_check
    check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  constraint shared_snapshot_retention_class_check
    check (retention_class = 'sensitive_content'),
  constraint shared_snapshot_source_draft_unique
    unique (source_private_summary_draft_id),
  constraint shared_snapshot_operation_unique
    unique (confirmation_operation_id)
);

alter table content.shared_snapshot enable row level security;

create index shared_snapshot_relationship_confirmed_idx
  on content.shared_snapshot (
    guide_explorer_relationship_id,
    confirmed_at desc
  );

create index shared_snapshot_explorer_confirmed_idx
  on content.shared_snapshot (
    explorer_profile_id,
    confirmed_at desc
  );

create index shared_snapshot_predecessor_idx
  on content.shared_snapshot (predecessor_shared_snapshot_id)
  where predecessor_shared_snapshot_id is not null;

create table content.shared_snapshot_item (
  shared_snapshot_item_id uuid primary key default gen_random_uuid(),
  shared_snapshot_id uuid not null
    references content.shared_snapshot(shared_snapshot_id),
  source_private_summary_draft_item_id uuid not null
    references content.private_summary_draft_item(
      private_summary_draft_item_id
    ),
  item_type text not null,
  source_type text not null,
  source_entity_id uuid null,
  source_locator text null,
  content_markdown text not null,
  display_order integer not null,
  content_sha256 text not null,
  created_at timestamptz not null default now(),
  retention_class text not null default 'sensitive_content',

  constraint shared_snapshot_item_type_check
    check (
      item_type in (
        'main_point',
        'supporting_detail',
        'quote',
        'question'
      )
    ),
  constraint shared_snapshot_item_source_type_check
    check (
      source_type in (
        'ai_interaction_message',
        'reflection',
        'waypoint',
        'explorer_authored'
      )
    ),
  constraint shared_snapshot_item_content_not_blank_check
    check (length(trim(content_markdown)) > 0),
  constraint shared_snapshot_item_order_check
    check (display_order > 0),
  constraint shared_snapshot_item_hash_check
    check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint shared_snapshot_item_retention_class_check
    check (retention_class = 'sensitive_content'),
  constraint shared_snapshot_item_order_unique
    unique (shared_snapshot_id, display_order),
  constraint shared_snapshot_item_source_unique
    unique (
      shared_snapshot_id,
      source_private_summary_draft_item_id
    )
);

alter table content.shared_snapshot_item enable row level security;

create index shared_snapshot_item_snapshot_order_idx
  on content.shared_snapshot_item (shared_snapshot_id, display_order);

-- Immutable content triggers. Publication labels may change only through the
-- separately defined service-role functions; content never changes in place.
create function content.solmind_protect_summary_revision_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'solmind_summary_revision_delete_forbidden';
  end if;

  if new.summary_id is distinct from old.summary_id
     or new.revision_number is distinct from old.revision_number
     or new.content_markdown is distinct from old.content_markdown
     or new.created_by_actor_type is distinct from old.created_by_actor_type
     or new.created_by_user_account_id is distinct from old.created_by_user_account_id
     or new.created_by_role_context is distinct from old.created_by_role_context
     or new.previous_revision_id is distinct from old.previous_revision_id
     or new.ai_change_summary is distinct from old.ai_change_summary
     or new.source_ai_model_invocation_id is distinct from old.source_ai_model_invocation_id
     or new.source_ai_interaction_session_id is distinct from old.source_ai_interaction_session_id
     or new.source_ai_interaction_message_id is distinct from old.source_ai_interaction_message_id
     or new.created_at is distinct from old.created_at
     or new.metadata is distinct from old.metadata
     or new.retention_class is distinct from old.retention_class
  then
    raise exception 'solmind_summary_revision_content_immutable';
  end if;

  return new;
end;
$$;

create trigger summary_revision_content_immutable_trigger
before update or delete on content.summary_revision
for each row execute function content.solmind_protect_summary_revision_content();

create function content.solmind_protect_summary_section_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'solmind_summary_section_delete_forbidden';
  end if;

  if new.summary_revision_id is distinct from old.summary_revision_id
     or new.section_type is distinct from old.section_type
     or new.section_title is distinct from old.section_title
     or new.content_markdown is distinct from old.content_markdown
     or new.display_order is distinct from old.display_order
     or new.created_at is distinct from old.created_at
     or new.retention_class is distinct from old.retention_class
  then
    raise exception 'solmind_summary_section_content_immutable';
  end if;

  return new;
end;
$$;

create trigger summary_section_content_immutable_trigger
before update or delete on content.summary_section
for each row execute function content.solmind_protect_summary_section_content();

create function content.solmind_protect_shared_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'solmind_shared_snapshot_update_forbidden';
  end if;
  raise exception 'solmind_shared_snapshot_delete_forbidden';
end;
$$;

create trigger shared_snapshot_immutable_trigger
before update or delete on content.shared_snapshot
for each row execute function content.solmind_protect_shared_snapshot();

create trigger shared_snapshot_item_immutable_trigger
before update or delete on content.shared_snapshot_item
for each row execute function content.solmind_protect_shared_snapshot();

create function content.solmind_protect_summary_publication_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'solmind_summary_publication_delete_forbidden';
  end if;

  if new.summary_id is distinct from old.summary_id
     or new.summary_revision_id is distinct from old.summary_revision_id
     or new.published_to_explorer_profile_id is distinct from old.published_to_explorer_profile_id
     or new.published_by_user_account_id is distinct from old.published_by_user_account_id
     or new.published_by_role_context is distinct from old.published_by_role_context
     or new.published_at is distinct from old.published_at
     or new.publication_operation_id is distinct from old.publication_operation_id
     or new.created_at is distinct from old.created_at
     or new.retention_class is distinct from old.retention_class
  then
    raise exception 'solmind_summary_publication_identity_immutable';
  end if;

  return new;
end;
$$;

create trigger summary_publication_identity_immutable_trigger
before update or delete on content.summary_publication
for each row execute function content.solmind_protect_summary_publication_identity();

revoke all on function content.solmind_protect_summary_revision_content()
  from public, anon, authenticated, service_role;
revoke all on function content.solmind_protect_summary_section_content()
  from public, anon, authenticated, service_role;
revoke all on function content.solmind_protect_shared_snapshot()
  from public, anon, authenticated, service_role;
revoke all on function content.solmind_protect_summary_publication_identity()
  from public, anon, authenticated, service_role;

create schema if not exists reporting;

-- The authoritative Explorer-facing read formula. The view is deliberately
-- ungranted in this dormant foundation.
create or replace view reporting.vw_explorer_published_summary_timeline
with (security_invoker = true) as
select
  publication.summary_publication_id,
  publication.published_to_explorer_profile_id as explorer_profile_id,
  summary.guide_explorer_relationship_id,
  summary.summary_id,
  revision.summary_revision_id,
  section.summary_section_id,
  section.section_title,
  section.content_markdown,
  section.display_order,
  publication.published_at
from content.summary_publication publication
join content.summary summary
  on summary.summary_id = publication.summary_id
join content.summary_revision revision
  on revision.summary_revision_id = publication.summary_revision_id
 and revision.summary_id = summary.summary_id
join content.summary_section section
  on section.summary_revision_id = revision.summary_revision_id
join core.guide_explorer_relationship relationship
  on relationship.guide_explorer_relationship_id =
     summary.guide_explorer_relationship_id
 and relationship.explorer_profile_id =
     publication.published_to_explorer_profile_id
where publication.publication_status = 'published'
  and revision.revision_status = 'published_to_explorer'
  and section.section_type = 'explorer_facing'
  and section.visibility = 'published_to_explorer'
  and relationship.relationship_status in ('active', 'paused');

revoke all on reporting.vw_explorer_published_summary_timeline from public;
revoke all on reporting.vw_explorer_published_summary_timeline
  from anon, authenticated, service_role;

create function public.solmind_check_summary_visibility_integrity(
  p_summary_id uuid,
  p_operation_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2s'
as $$
declare
  v_mismatch boolean;
begin
  if p_summary_id is null or p_operation_id is null then
    raise exception 'solmind_summary_visibility_check_invalid_request';
  end if;

  if not exists (
       select 1
         from content.summary summary
        where summary.summary_id = p_summary_id
     )
  then
    raise exception 'solmind_summary_visibility_check_not_found';
  end if;

  select
    exists (
      select 1
        from content.summary_publication publication
        join content.summary summary
          on summary.summary_id = publication.summary_id
       where publication.summary_id = p_summary_id
         and publication.publication_status = 'published'
         and (
           summary.summary_status <> 'published'
           or summary.current_revision_id is distinct from
              publication.summary_revision_id
           or not exists (
             select 1
               from content.summary_revision revision
              where revision.summary_revision_id =
                    publication.summary_revision_id
                and revision.summary_id = publication.summary_id
                and revision.revision_status = 'published_to_explorer'
           )
           or not exists (
             select 1
               from content.summary_section section
              where section.summary_revision_id =
                    publication.summary_revision_id
                and section.section_type = 'explorer_facing'
                and section.visibility = 'published_to_explorer'
           )
           or exists (
             select 1
               from content.summary_section section
              where section.summary_revision_id =
                    publication.summary_revision_id
                and section.section_type = 'explorer_facing'
                and section.visibility = 'explorer_publishable'
           )
           or not exists (
             select 1
               from core.guide_explorer_relationship relationship
              where relationship.guide_explorer_relationship_id =
                    summary.guide_explorer_relationship_id
                and relationship.explorer_profile_id =
                    publication.published_to_explorer_profile_id
                and relationship.relationship_status in ('active', 'paused')
           )
         )
    )
    or exists (
      select 1
        from content.summary summary
       where summary.summary_id = p_summary_id
         and summary.summary_status = 'published'
         and not exists (
           select 1
             from content.summary_publication publication
            where publication.summary_id = summary.summary_id
              and publication.publication_status = 'published'
         )
    )
    or exists (
      select 1
        from content.summary_revision revision
       where revision.summary_id = p_summary_id
         and revision.revision_status = 'published_to_explorer'
         and not exists (
           select 1
             from content.summary_publication publication
            where publication.summary_id = revision.summary_id
              and publication.summary_revision_id =
                  revision.summary_revision_id
              and publication.publication_status = 'published'
         )
    )
    or exists (
      select 1
        from content.summary_section section
        join content.summary_revision revision
          on revision.summary_revision_id = section.summary_revision_id
       where revision.summary_id = p_summary_id
         and section.visibility = 'published_to_explorer'
         and not exists (
           select 1
             from content.summary_publication publication
            where publication.summary_id = revision.summary_id
              and publication.summary_revision_id =
                  revision.summary_revision_id
              and publication.publication_status = 'published'
         )
    )
    into v_mismatch;

  if v_mismatch
     and not exists (
       select 1
         from audit.audit_event event
        where event.event_type = 'visibility_state_mismatch'
          and event.target_entity_type = 'summary'
          and event.target_entity_id = p_summary_id
          and event.metadata ->> 'operation_id' = p_operation_id::text
     )
  then
    insert into audit.audit_event (
      event_type,
      actor_user_account_id,
      actor_role_context,
      target_entity_type,
      target_entity_id,
      action,
      reason_code,
      event_summary,
      metadata
    ) values (
      'visibility_state_mismatch',
      null,
      'system',
      'summary',
      p_summary_id,
      'deny',
      'summary_visibility_state_mismatch',
      'Summary visibility labels did not match the authoritative publication state.',
      pg_catalog.jsonb_build_object(
        'operation_id', p_operation_id,
        'summary_id', p_summary_id
      )
    );
  end if;

  return not v_mismatch;
end;
$$;

create function public.solmind_publish_summary_to_explorer(
  p_summary_id uuid,
  p_summary_revision_id uuid,
  p_explorer_profile_id uuid,
  p_published_by_user_account_id uuid,
  p_expected_summary_version bigint,
  p_operation_id uuid
)
returns table (
  outcome text,
  summary_publication_id uuid,
  summary_version bigint
)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2s'
as $$
declare
  v_summary content.summary%rowtype;
  v_existing content.summary_publication%rowtype;
  v_publication_id uuid := pg_catalog.gen_random_uuid();
begin
  if p_summary_id is null
     or p_summary_revision_id is null
     or p_explorer_profile_id is null
     or p_published_by_user_account_id is null
     or p_expected_summary_version is null
     or p_operation_id is null
  then
    raise exception 'solmind_summary_publish_invalid_request';
  end if;

  select * into v_existing
    from content.summary_publication
   where publication_operation_id = p_operation_id;

  if found then
    if v_existing.summary_id = p_summary_id
       and v_existing.summary_revision_id = p_summary_revision_id
       and v_existing.published_to_explorer_profile_id =
           p_explorer_profile_id
       and v_existing.published_by_user_account_id =
           p_published_by_user_account_id
    then
      return query
      select
        'already_published'::text,
        v_existing.summary_publication_id,
        summary.version
      from content.summary summary
      where summary.summary_id = p_summary_id;
      return;
    end if;
    raise exception 'solmind_summary_publish_operation_conflict';
  end if;

  select * into v_summary
    from content.summary
   where summary_id = p_summary_id
   for update;

  if not found then
    raise exception 'solmind_summary_publish_not_found';
  end if;

  if v_summary.version <> p_expected_summary_version then
    raise exception 'solmind_summary_publish_stale_version';
  end if;

  if v_summary.current_revision_id is distinct from p_summary_revision_id
     or not exists (
       select 1
         from content.summary_revision revision
        where revision.summary_revision_id = p_summary_revision_id
          and revision.summary_id = p_summary_id
          and revision.revision_status = 'guide_approved'
     )
  then
    raise exception 'solmind_summary_publish_revision_not_approved';
  end if;

  if not exists (
       select 1
         from core.guide_explorer_relationship relationship
         join core.guide_profile guide
           on guide.guide_profile_id = relationship.guide_profile_id
         join identity.user_account account
           on account.user_account_id = guide.user_account_id
        where relationship.guide_explorer_relationship_id =
              v_summary.guide_explorer_relationship_id
          and relationship.explorer_profile_id = p_explorer_profile_id
          and relationship.relationship_status in ('active', 'paused')
          and guide.user_account_id = p_published_by_user_account_id
          and guide.status = 'active'
          and account.account_status = 'active'
          and exists (
            select 1
              from identity.user_role_assignment assignment
             where assignment.user_account_id = guide.user_account_id
               and assignment.role_code = 'guide'
               and assignment.role_status = 'active'
          )
     )
  then
    raise exception 'solmind_summary_publish_relationship_denied';
  end if;

  if not exists (
       select 1
         from content.summary_section section
        where section.summary_revision_id = p_summary_revision_id
          and section.section_type = 'explorer_facing'
          and section.visibility = 'explorer_publishable'
     )
  then
    raise exception 'solmind_summary_publish_no_eligible_section';
  end if;

  update content.summary_publication publication
     set publication_status = 'superseded',
         unpublished_at = now(),
         unpublished_by_user_account_id = p_published_by_user_account_id
   where publication.summary_id = p_summary_id
     and publication.published_to_explorer_profile_id = p_explorer_profile_id
     and publication.publication_status = 'published';

  update content.summary_revision revision
     set revision_status = 'superseded'
   where revision.summary_id = p_summary_id
     and revision.summary_revision_id <> p_summary_revision_id
     and revision.revision_status = 'published_to_explorer';

  update content.summary_section section
     set visibility = 'explorer_publishable'
   where section.summary_revision_id in (
           select revision.summary_revision_id
             from content.summary_revision revision
            where revision.summary_id = p_summary_id
              and revision.summary_revision_id <> p_summary_revision_id
         )
     and section.section_type = 'explorer_facing'
     and section.visibility = 'published_to_explorer';

  insert into content.summary_publication (
    summary_publication_id,
    summary_id,
    summary_revision_id,
    published_to_explorer_profile_id,
    published_by_user_account_id,
    publication_operation_id,
    last_operation_id
  ) values (
    v_publication_id,
    p_summary_id,
    p_summary_revision_id,
    p_explorer_profile_id,
    p_published_by_user_account_id,
    p_operation_id,
    p_operation_id
  );

  update content.summary_publication publication
     set superseded_by_summary_publication_id = v_publication_id
   where publication.summary_id = p_summary_id
     and publication.published_to_explorer_profile_id = p_explorer_profile_id
     and publication.publication_status = 'superseded'
     and publication.superseded_by_summary_publication_id is null;

  update content.summary_revision
     set revision_status = 'published_to_explorer'
   where summary_revision_id = p_summary_revision_id;

  update content.summary_section
     set visibility = 'published_to_explorer'
   where summary_revision_id = p_summary_revision_id
     and section_type = 'explorer_facing'
     and visibility = 'explorer_publishable';

  update content.summary
     set summary_status = 'published',
         version = version + 1,
         last_operation_id = p_operation_id,
         updated_at = now()
   where summary_id = p_summary_id
   returning version into v_summary.version;

  insert into audit.audit_event (
    event_type,
    actor_user_account_id,
    actor_role_context,
    target_entity_type,
    target_entity_id,
    action,
    reason_code,
    event_summary,
    metadata
  ) values (
    'summary_publication_changed',
    p_published_by_user_account_id,
    'guide',
    'summary_publication',
    v_publication_id,
    'publish',
    'guide_approved_publication',
    'Guide published an approved Summary revision to its Explorer.',
    pg_catalog.jsonb_build_object(
      'operation_id', p_operation_id,
      'summary_id', p_summary_id,
      'summary_revision_id', p_summary_revision_id
    )
  );

  return query
  select 'published'::text, v_publication_id, v_summary.version;
end;
$$;

create function public.solmind_unpublish_summary_from_explorer(
  p_summary_publication_id uuid,
  p_unpublished_by_user_account_id uuid,
  p_expected_summary_version bigint,
  p_operation_id uuid
)
returns table (
  outcome text,
  summary_publication_id uuid,
  summary_version bigint
)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2s'
as $$
declare
  v_publication content.summary_publication%rowtype;
  v_summary content.summary%rowtype;
begin
  if p_summary_publication_id is null
     or p_unpublished_by_user_account_id is null
     or p_expected_summary_version is null
     or p_operation_id is null
  then
    raise exception 'solmind_summary_unpublish_invalid_request';
  end if;

  select * into v_publication
    from content.summary_publication publication
   where publication.summary_publication_id = p_summary_publication_id
   for update;

  if not found then
    raise exception 'solmind_summary_unpublish_not_found';
  end if;

  if v_publication.last_operation_id = p_operation_id
     and v_publication.publication_status = 'unpublished'
  then
    return query
    select
      'already_unpublished'::text,
      v_publication.summary_publication_id,
      summary.version
    from content.summary summary
    where summary.summary_id = v_publication.summary_id;
    return;
  end if;

  if exists (
       select 1
         from content.summary_publication publication
        where publication.last_operation_id = p_operation_id
     )
  then
    raise exception 'solmind_summary_unpublish_operation_conflict';
  end if;

  select * into v_summary
    from content.summary
   where summary_id = v_publication.summary_id
   for update;

  if v_summary.version <> p_expected_summary_version then
    raise exception 'solmind_summary_unpublish_stale_version';
  end if;

  if v_publication.publication_status <> 'published' then
    raise exception 'solmind_summary_unpublish_not_active';
  end if;

  if not exists (
       select 1
         from core.guide_explorer_relationship relationship
         join core.guide_profile guide
           on guide.guide_profile_id = relationship.guide_profile_id
         join identity.user_account account
           on account.user_account_id = guide.user_account_id
        where relationship.guide_explorer_relationship_id =
              v_summary.guide_explorer_relationship_id
          and guide.user_account_id = p_unpublished_by_user_account_id
          and guide.status = 'active'
          and account.account_status = 'active'
          and exists (
            select 1
              from identity.user_role_assignment assignment
             where assignment.user_account_id = guide.user_account_id
               and assignment.role_code = 'guide'
               and assignment.role_status = 'active'
          )
     )
  then
    raise exception 'solmind_summary_unpublish_relationship_denied';
  end if;

  update content.summary_publication publication
     set publication_status = 'unpublished',
         unpublished_at = now(),
         unpublished_by_user_account_id =
           p_unpublished_by_user_account_id,
         last_operation_id = p_operation_id
   where publication.summary_publication_id = p_summary_publication_id;

  update content.summary_revision
     set revision_status = 'guide_approved'
   where summary_revision_id = v_publication.summary_revision_id;

  update content.summary_section
     set visibility = 'explorer_publishable'
   where summary_revision_id = v_publication.summary_revision_id
     and section_type = 'explorer_facing'
     and visibility = 'published_to_explorer';

  update content.summary
     set summary_status = 'approved',
         version = version + 1,
         last_operation_id = p_operation_id,
         updated_at = now()
   where summary_id = v_publication.summary_id
   returning version into v_summary.version;

  insert into audit.audit_event (
    event_type,
    actor_user_account_id,
    actor_role_context,
    target_entity_type,
    target_entity_id,
    action,
    reason_code,
    event_summary,
    metadata
  ) values (
    'summary_publication_changed',
    p_unpublished_by_user_account_id,
    'guide',
    'summary_publication',
    p_summary_publication_id,
    'unpublish',
    'guide_unpublished_summary',
    'Guide unpublished a Summary revision from its Explorer.',
    pg_catalog.jsonb_build_object(
      'operation_id', p_operation_id,
      'summary_id', v_publication.summary_id,
      'summary_revision_id', v_publication.summary_revision_id
    )
  );

  return query
  select
    'unpublished'::text,
    p_summary_publication_id,
    v_summary.version;
end;
$$;

create function public.solmind_confirm_shared_snapshot(
  p_private_summary_draft_id uuid,
  p_confirmed_by_user_account_id uuid,
  p_expected_draft_version bigint,
  p_lineage_type text,
  p_predecessor_shared_snapshot_id uuid,
  p_operation_id uuid
)
returns table (
  outcome text,
  shared_snapshot_id uuid,
  draft_version bigint
)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2s'
as $$
declare
  v_draft content.private_summary_draft%rowtype;
  v_existing content.shared_snapshot%rowtype;
  v_snapshot_id uuid := pg_catalog.gen_random_uuid();
  v_snapshot_sha256 text;
  v_now timestamptz := now();
begin
  if p_private_summary_draft_id is null
     or p_confirmed_by_user_account_id is null
     or p_expected_draft_version is null
     or p_lineage_type is null
     or p_operation_id is null
     or p_lineage_type not in ('original', 'addendum', 'replacement')
  then
    raise exception 'solmind_shared_snapshot_invalid_request';
  end if;

  select * into v_existing
    from content.shared_snapshot
   where confirmation_operation_id = p_operation_id;

  if found then
    if v_existing.source_private_summary_draft_id =
         p_private_summary_draft_id
       and v_existing.confirmed_by_user_account_id =
           p_confirmed_by_user_account_id
       and v_existing.lineage_type = p_lineage_type
       and v_existing.predecessor_shared_snapshot_id is not distinct from
           p_predecessor_shared_snapshot_id
    then
      return query
      select
        'already_confirmed'::text,
        v_existing.shared_snapshot_id,
        draft.version
      from content.private_summary_draft draft
      where draft.private_summary_draft_id =
            p_private_summary_draft_id;
      return;
    end if;
    raise exception 'solmind_shared_snapshot_operation_conflict';
  end if;

  select * into v_draft
    from content.private_summary_draft
   where private_summary_draft_id = p_private_summary_draft_id
   for update;

  if not found then
    raise exception 'solmind_shared_snapshot_draft_not_found';
  end if;

  if v_draft.version <> p_expected_draft_version then
    raise exception 'solmind_shared_snapshot_stale_version';
  end if;

  if v_draft.draft_status <> 'reviewable' then
    raise exception 'solmind_shared_snapshot_draft_not_reviewable';
  end if;

  if v_now > v_draft.sendable_until then
    update content.private_summary_draft
       set draft_status = 'expired_not_sent',
           version = version + 1,
           last_operation_id = p_operation_id,
           updated_at = v_now
     where private_summary_draft_id = p_private_summary_draft_id
     returning version into v_draft.version;

    return query
    select
      'expired_not_sent'::text,
      null::uuid,
      v_draft.version;
    return;
  end if;

  if not exists (
       select 1
         from core.guide_explorer_relationship relationship
         join core.explorer_profile explorer
           on explorer.explorer_profile_id = relationship.explorer_profile_id
         join identity.user_account account
           on account.user_account_id = explorer.user_account_id
        where relationship.guide_explorer_relationship_id =
              v_draft.guide_explorer_relationship_id
          and relationship.explorer_profile_id = v_draft.explorer_profile_id
          and relationship.relationship_status in ('active', 'paused')
          and explorer.user_account_id = p_confirmed_by_user_account_id
          and explorer.status = 'active'
          and account.account_status = 'active'
          and exists (
            select 1
              from identity.user_role_assignment assignment
             where assignment.user_account_id = explorer.user_account_id
               and assignment.role_code = 'explorer'
               and assignment.role_status = 'active'
          )
     )
  then
    raise exception 'solmind_shared_snapshot_explorer_denied';
  end if;

  if (
       p_lineage_type = 'original'
       and p_predecessor_shared_snapshot_id is not null
     )
     or
     (
       p_lineage_type in ('addendum', 'replacement')
       and not exists (
         select 1
           from content.shared_snapshot predecessor
          where predecessor.shared_snapshot_id =
                p_predecessor_shared_snapshot_id
            and predecessor.guide_explorer_relationship_id =
                v_draft.guide_explorer_relationship_id
            and predecessor.explorer_profile_id =
                v_draft.explorer_profile_id
       )
     )
  then
    raise exception 'solmind_shared_snapshot_invalid_lineage';
  end if;

  if not exists (
       select 1
         from content.private_summary_draft_item item
        where item.private_summary_draft_id = p_private_summary_draft_id
          and item.selection_state = 'included'
     )
  then
    raise exception 'solmind_shared_snapshot_no_included_items';
  end if;

  select pg_catalog.encode(
           extensions.digest(
             pg_catalog.convert_to(
               pg_catalog.string_agg(
                 item.private_summary_draft_item_id::text || '|' ||
                 item.item_type || '|' ||
                 item.source_type || '|' ||
                 coalesce(item.source_entity_id::text, '') || '|' ||
                 coalesce(item.source_locator, '') || '|' ||
                 item.content_markdown,
                 E'\n'
                 order by item.display_order,
                          item.private_summary_draft_item_id
               ),
               'UTF8'
             ),
             'sha256'
           ),
           'hex'
         )
    into v_snapshot_sha256
    from content.private_summary_draft_item item
   where item.private_summary_draft_id = p_private_summary_draft_id
     and item.selection_state = 'included';

  insert into content.shared_snapshot (
    shared_snapshot_id,
    source_private_summary_draft_id,
    guide_explorer_relationship_id,
    explorer_profile_id,
    source_ai_interaction_session_id,
    source_waypoint_id,
    lineage_type,
    predecessor_shared_snapshot_id,
    confirmed_by_user_account_id,
    confirmed_at,
    confirmation_operation_id,
    snapshot_sha256
  ) values (
    v_snapshot_id,
    p_private_summary_draft_id,
    v_draft.guide_explorer_relationship_id,
    v_draft.explorer_profile_id,
    v_draft.source_ai_interaction_session_id,
    v_draft.source_waypoint_id,
    p_lineage_type,
    p_predecessor_shared_snapshot_id,
    p_confirmed_by_user_account_id,
    v_now,
    p_operation_id,
    v_snapshot_sha256
  );

  insert into content.shared_snapshot_item (
    shared_snapshot_id,
    source_private_summary_draft_item_id,
    item_type,
    source_type,
    source_entity_id,
    source_locator,
    content_markdown,
    display_order,
    content_sha256
  )
  select
    v_snapshot_id,
    item.private_summary_draft_item_id,
    item.item_type,
    item.source_type,
    item.source_entity_id,
    item.source_locator,
    item.content_markdown,
    item.display_order,
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(item.content_markdown, 'UTF8'),
        'sha256'
      ),
      'hex'
    )
  from content.private_summary_draft_item item
  where item.private_summary_draft_id = p_private_summary_draft_id
    and item.selection_state = 'included'
  order by item.display_order, item.private_summary_draft_item_id;

  update content.private_summary_draft
     set draft_status = 'confirmed',
         version = version + 1,
         last_operation_id = p_operation_id,
         updated_at = v_now
   where private_summary_draft_id = p_private_summary_draft_id
   returning version into v_draft.version;

  insert into audit.audit_event (
    event_type,
    actor_user_account_id,
    actor_role_context,
    target_entity_type,
    target_entity_id,
    action,
    reason_code,
    event_summary,
    metadata
  ) values (
    'shared_snapshot_confirmed',
    p_confirmed_by_user_account_id,
    'explorer',
    'shared_snapshot',
    v_snapshot_id,
    'confirm',
    'explorer_exact_review_confirmed',
    'Explorer confirmed an immutable Shared Snapshot.',
    pg_catalog.jsonb_build_object(
      'operation_id', p_operation_id,
      'private_summary_draft_id', p_private_summary_draft_id,
      'lineage_type', p_lineage_type
    )
  );

  return query
  select 'confirmed'::text, v_snapshot_id, v_draft.version;
end;
$$;

revoke all on function public.solmind_publish_summary_to_explorer(
  uuid, uuid, uuid, uuid, bigint, uuid
) from public;
revoke execute on function public.solmind_publish_summary_to_explorer(
  uuid, uuid, uuid, uuid, bigint, uuid
) from anon, authenticated;
grant execute on function public.solmind_publish_summary_to_explorer(
  uuid, uuid, uuid, uuid, bigint, uuid
) to service_role;

revoke all on function public.solmind_unpublish_summary_from_explorer(
  uuid, uuid, bigint, uuid
) from public;
revoke execute on function public.solmind_unpublish_summary_from_explorer(
  uuid, uuid, bigint, uuid
) from anon, authenticated;
grant execute on function public.solmind_unpublish_summary_from_explorer(
  uuid, uuid, bigint, uuid
) to service_role;

revoke all on function public.solmind_confirm_shared_snapshot(
  uuid, uuid, bigint, text, uuid, uuid
) from public;
revoke execute on function public.solmind_confirm_shared_snapshot(
  uuid, uuid, bigint, text, uuid, uuid
) from anon, authenticated;
grant execute on function public.solmind_confirm_shared_snapshot(
  uuid, uuid, bigint, text, uuid, uuid
) to service_role;

revoke all on function public.solmind_check_summary_visibility_integrity(
  uuid, uuid
) from public;
revoke execute on function public.solmind_check_summary_visibility_integrity(
  uuid, uuid
) from anon, authenticated;
grant execute on function public.solmind_check_summary_visibility_integrity(
  uuid, uuid
) to service_role;

comment on table content.summary is
  'Guide-originated Summary container. Container-level visibility is intentionally absent; content.summary_publication is authoritative.';
comment on table content.summary_revision is
  'Immutable versioned Guide-originated Summary content. Publishing changes only synchronized lifecycle labels.';
comment on table content.summary_section is
  'Immutable Summary sections with exact section-type and visibility pairing. Sensitive section types are permanently guide_only.';
comment on table content.summary_publication is
  'Authoritative explicit Guide-to-Explorer Summary publication event with reversible, preserved history.';
comment on table content.private_summary_draft is
  'Explorer-private exact-review owner. It is never Guide-visible and is not a Shared Snapshot.';
comment on table content.private_summary_draft_item is
  'Explorer-private candidate, included, and excluded exact-review items. Excluded content is never copied to a Shared Snapshot.';
comment on table content.shared_snapshot is
  'Immutable Explorer-confirmed Guide-visible artifact. It grants no access to private sources.';
comment on table content.shared_snapshot_item is
  'Immutable ordered exact content and provenance copied only from included private-draft items.';
comment on column content.private_summary_draft.source_waypoint_id is
  'Reserved source identity without a foreign key until the separately approved Waypoint persistence owner exists.';
comment on column content.shared_snapshot.source_waypoint_id is
  'Preserved source identity without a foreign key until the separately approved Waypoint persistence owner exists.';
