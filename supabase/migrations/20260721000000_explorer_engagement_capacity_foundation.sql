-- SolMind MVP0 WI008-S02B: dormant Explorer engagement-capacity and lock-key foundation.
-- This migration adds no issuance or acceptance function, caller, route, provider IO,
-- delivery, browser grant, cloud action, deployment, or real-user activation.

begin;

create table core.explorer_engagement_capacity_policy (
  capacity_policy_name text primary key,
  minimum_value integer not null,
  active_value integer not null,
  maximum_value integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_class text not null default 'security_log',

  constraint explorer_engagement_capacity_policy_name_check
    check (
      capacity_policy_name in (
        'open_invitation_maximum',
        'current_guide_relationship_maximum'
      )
    ),

  constraint explorer_engagement_capacity_policy_values_check
    check (
      minimum_value between 1 and 10
      and maximum_value between 1 and 10
      and minimum_value <= active_value
      and active_value <= maximum_value
    ),

  constraint explorer_engagement_capacity_policy_bounds_check
    check (minimum_value = 1 and maximum_value = 10),

  constraint explorer_engagement_capacity_policy_retention_check
    check (retention_class = 'security_log'),

  constraint explorer_engagement_capacity_policy_timestamps_check
    check (updated_at >= created_at)
);

alter table core.explorer_engagement_capacity_policy enable row level security;

revoke all on table core.explorer_engagement_capacity_policy
  from public, anon, authenticated, service_role;

insert into core.explorer_engagement_capacity_policy (
  capacity_policy_name,
  minimum_value,
  active_value,
  maximum_value
) values
  ('open_invitation_maximum', 1, 1, 10),
  ('current_guide_relationship_maximum', 1, 1, 10);

comment on table core.explorer_engagement_capacity_policy is
  'Protected WI008 capacity policy. Fixed rows independently bound open Explorer invitations and current Guide relationships. No app role has direct table access. A later separately approved restricted audited operation owns policy changes.';

lock table core.explorer_invite in share mode;

do $$
begin
  if exists (
    select 1
      from core.explorer_invite invitation
     where invitation.invite_status in ('created', 'sent')
     group by
       invitation.guide_profile_id,
       invitation.practice_id,
       invitation.contact_method_type,
       invitation.normalized_contact_value
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'solmind_explorer_capacity_open_invitation_preflight_failed';
  end if;
end;
$$;

create unique index explorer_invite_one_open_scope_idx
  on core.explorer_invite (
    guide_profile_id,
    practice_id,
    contact_method_type,
    normalized_contact_value
  )
  where invite_status in ('created', 'sent');

lock table core.guide_explorer_relationship in share mode;

do $$
begin
  if exists (
    select 1
      from core.guide_explorer_relationship relationship
     where relationship.created_from_invite_id is not null
     group by relationship.created_from_invite_id
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'solmind_explorer_capacity_invite_provenance_preflight_failed';
  end if;
end;
$$;

create unique index guide_explorer_relationship_one_invite_origin_idx
  on core.guide_explorer_relationship (created_from_invite_id)
  where created_from_invite_id is not null;

create function private.solmind_explorer_invitation_domain_lock_keys(
  p_explorer_invite_id uuid,
  p_guide_profile_id uuid,
  p_practice_id uuid,
  p_contact_method_type text,
  p_normalized_contact_value text
)
returns bigint[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.array_agg(keys.lock_key order by keys.lock_key)
    from (
      select distinct pg_catalog.hashtextextended(material.lock_material, 0)
        as lock_key
        from (
          values
            (
              'solmind:authorizing-domain:invitation:v1|'
              || 'role=8:explorer|invite=36:' || p_explorer_invite_id::text
            ),
            (
              'solmind:authorizing-domain:contact:v1|'
              || 'type=' || pg_catalog.octet_length(p_contact_method_type)::text
              || ':' || p_contact_method_type
              || '|value=' || pg_catalog.octet_length(p_normalized_contact_value)::text
              || ':' || p_normalized_contact_value
            ),
            (
              'solmind:authorizing-domain:invitation-sibling:v1|'
              || 'role=8:explorer'
              || '|guide=36:' || p_guide_profile_id::text
              || '|practice=36:' || p_practice_id::text
              || '|type=' || pg_catalog.octet_length(p_contact_method_type)::text
              || ':' || p_contact_method_type
              || '|value=' || pg_catalog.octet_length(p_normalized_contact_value)::text
              || ':' || p_normalized_contact_value
            )
        ) material(lock_material)
       where material.lock_material is not null
    ) keys
$$;

alter function private.solmind_explorer_invitation_domain_lock_keys(
  uuid, uuid, uuid, text, text
) owner to postgres;

revoke all on function private.solmind_explorer_invitation_domain_lock_keys(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated, service_role;

comment on function private.solmind_explorer_invitation_domain_lock_keys(
  uuid, uuid, uuid, text, text
) is
  'Canonical Explorer invitation, contact, and scope-sibling advisory-lock keys shared by later issuance, preparation, and acceptance slices. Returns one sorted, de-duplicated array and owns no authorization, row locking, capacity decision, state change, audit, evidence, provider, session, or cookie behavior.';

commit;
