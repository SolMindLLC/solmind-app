-- SolMind MVP0 Scheduling Foundation.
-- Purpose:
--   - create scheduling schema for MVP0 appointment data
--   - add first and future Guide/Explorer appointment records
--   - add appointment participant confirmation records
--
-- This migration intentionally creates no users, no policies, no grants,
-- no real pilot data, no seed data, no UI, no appointment reminders,
-- no notification delivery, no calendar integration, no recurring appointments,
-- and no storage buckets.

create schema if not exists scheduling;

create table if not exists scheduling.appointment (
  appointment_id uuid primary key default gen_random_uuid(),
  guide_explorer_relationship_id uuid not null references core.guide_explorer_relationship(guide_explorer_relationship_id),
  guide_profile_id uuid not null references core.guide_profile(guide_profile_id),
  explorer_profile_id uuid not null references core.explorer_profile(explorer_profile_id),
  proposed_by_user_account_id uuid null references identity.user_account(user_account_id),
  confirmed_by_user_account_id uuid null references identity.user_account(user_account_id),
  scheduled_start_at timestamptz null,
  scheduled_end_at timestamptz null,
  timezone text null,
  mode text not null default 'other',
  location_or_link text null,
  appointment_status text not null default 'to_be_scheduled',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'core_business',

  constraint appointment_status_check
    check (appointment_status in ('to_be_scheduled', 'proposed', 'confirmed', 'completed', 'canceled', 'rescheduled', 'no_show')),

  constraint appointment_mode_check
    check (mode in ('in_person', 'phone', 'video', 'other')),

  constraint appointment_retention_class_check
    check (retention_class = 'core_business'),

  constraint appointment_timezone_not_blank_check
    check (timezone is null or length(trim(timezone)) > 0),

  constraint appointment_location_or_link_not_blank_check
    check (location_or_link is null or length(trim(location_or_link)) > 0),

  constraint appointment_notes_not_blank_check
    check (notes is null or length(trim(notes)) > 0),

  constraint appointment_scheduled_time_order_check
    check (
      scheduled_start_at is null
      or scheduled_end_at is null
      or scheduled_end_at > scheduled_start_at
    ),

  constraint appointment_confirmed_status_fields_check
    check (
      appointment_status not in ('confirmed', 'completed', 'no_show')
      or (
        confirmed_by_user_account_id is not null
        and scheduled_start_at is not null
      )
    )
);

alter table scheduling.appointment enable row level security;

create index if not exists appointment_relationship_start_idx
  on scheduling.appointment (guide_explorer_relationship_id, scheduled_start_at);

create index if not exists appointment_status_start_idx
  on scheduling.appointment (appointment_status, scheduled_start_at);

create index if not exists appointment_guide_status_start_idx
  on scheduling.appointment (guide_profile_id, appointment_status, scheduled_start_at);

create index if not exists appointment_explorer_status_start_idx
  on scheduling.appointment (explorer_profile_id, appointment_status, scheduled_start_at);

create table if not exists scheduling.appointment_participant (
  appointment_participant_id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references scheduling.appointment(appointment_id),
  user_account_id uuid not null references identity.user_account(user_account_id),
  participant_role text not null,
  confirmation_status text not null default 'pending',
  confirmed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  retention_class text not null default 'core_business',

  constraint appointment_participant_role_check
    check (participant_role in ('guide', 'explorer')),

  constraint appointment_participant_confirmation_status_check
    check (confirmation_status in ('pending', 'confirmed', 'declined')),

  constraint appointment_participant_retention_class_check
    check (retention_class = 'core_business'),

  constraint appointment_participant_confirmed_at_check
    check (
      (confirmation_status = 'confirmed' and confirmed_at is not null)
      or (confirmation_status <> 'confirmed' and confirmed_at is null)
    ),

  constraint appointment_participant_unique_user_check
    unique (appointment_id, user_account_id),

  constraint appointment_participant_unique_role_check
    unique (appointment_id, participant_role)
);

alter table scheduling.appointment_participant enable row level security;

create index if not exists appointment_participant_appointment_role_idx
  on scheduling.appointment_participant (appointment_id, participant_role);

create index if not exists appointment_participant_user_status_idx
  on scheduling.appointment_participant (user_account_id, confirmation_status);

comment on schema scheduling is 'SolMind MVP0 appointment and scheduling data.';

comment on table scheduling.appointment is
  'First and future Guide/Explorer appointments. Reminder delivery, calendar integration, and recurring appointments are intentionally deferred.';

comment on table scheduling.appointment_participant is
  'Guide and Explorer participant confirmation state for an appointment.';

comment on column scheduling.appointment.guide_explorer_relationship_id is
  'Relationship context for the appointment.';

comment on column scheduling.appointment.guide_profile_id is
  'Denormalized convenience reference for Guide appointment read paths.';

comment on column scheduling.appointment.explorer_profile_id is
  'Denormalized convenience reference for Explorer appointment read paths.';

comment on column scheduling.appointment.notes is
  'Logistical appointment notes only. Private Guide notes and sensitive observations belong in content tables, not appointment notes.';

comment on column scheduling.appointment_participant.confirmation_status is
  'Participant-level confirmation state. Appointment lifecycle state remains on scheduling.appointment.';