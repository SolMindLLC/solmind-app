import type { SuggestedWaypointWholePathRole } from "./suggestedWaypointWholePathSafety";

export const SUGGESTED_WAYPOINT_FIXTURE_ID =
  "PRJ01_V-WS05-WI022-S03-LANE-G" as const;

const ROLES = [
  "assigned-guide",
  "assigned-explorer",
  "unrelated-guide",
  "unrelated-explorer",
  "ended-explorer",
] as const satisfies readonly SuggestedWaypointWholePathRole[];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SYNTHETIC_EMAIL = /^[a-z0-9][a-z0-9.-]{1,62}@synthetic\.invalid$/u;

export type SuggestedWaypointFixtureActorBinding = Readonly<{
  role: SuggestedWaypointWholePathRole;
  authUserId: string;
  email: string;
}>;

const IDS = Object.freeze({
  accounts: Object.freeze({
    "assigned-guide": "02208000-0000-4000-8000-000000000001",
    "assigned-explorer": "02208000-0000-4000-8000-000000000002",
    "unrelated-guide": "02208000-0000-4000-8000-000000000003",
    "unrelated-explorer": "02208000-0000-4000-8000-000000000004",
    "ended-explorer": "02208000-0000-4000-8000-000000000005",
  }),
  assignments: Object.freeze({
    "assigned-guide": "02208000-1000-4000-8000-000000000001",
    "assigned-explorer": "02208000-1000-4000-8000-000000000002",
    "unrelated-guide": "02208000-1000-4000-8000-000000000003",
    "unrelated-explorer": "02208000-1000-4000-8000-000000000004",
    "ended-explorer": "02208000-1000-4000-8000-000000000005",
  }),
  providerIdentities: Object.freeze({
    "assigned-guide": "02208000-1100-4000-8000-000000000001",
    "assigned-explorer": "02208000-1100-4000-8000-000000000002",
    "unrelated-guide": "02208000-1100-4000-8000-000000000003",
    "unrelated-explorer": "02208000-1100-4000-8000-000000000004",
    "ended-explorer": "02208000-1100-4000-8000-000000000005",
  }),
  sessions: Object.freeze({
    "assigned-guide": "02208000-1200-4000-8000-000000000001",
    "assigned-explorer": "02208000-1200-4000-8000-000000000002",
    "unrelated-guide": "02208000-1200-4000-8000-000000000003",
    "unrelated-explorer": "02208000-1200-4000-8000-000000000004",
    "ended-explorer": "02208000-1200-4000-8000-000000000005",
  }),
  organization: "02208000-2000-4000-8000-000000000001",
  practice: "02208000-2100-4000-8000-000000000001",
  guides: Object.freeze({
    assigned: "02208000-3000-4000-8000-000000000001",
    unrelated: "02208000-3000-4000-8000-000000000002",
  }),
  explorers: Object.freeze({
    assigned: "02208000-3100-4000-8000-000000000001",
    unrelated: "02208000-3100-4000-8000-000000000002",
    ended: "02208000-3100-4000-8000-000000000003",
  }),
  practiceGuides: Object.freeze({
    assigned: "02208000-4000-4000-8000-000000000001",
    unrelated: "02208000-4000-4000-8000-000000000002",
  }),
  relationships: Object.freeze({
    assigned: "02208000-5000-4000-8000-000000000001",
    unrelated: "02208000-5000-4000-8000-000000000002",
    ended: "02208000-5000-4000-8000-000000000003",
  }),
});

export type SuggestedWaypointFixtureScenarioIds = Readonly<{
  assignedRelationshipId: string;
  unrelatedRelationshipId: string;
  endedRelationshipId: string;
}>;

function sqlText(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function validateBindings(
  bindings: readonly SuggestedWaypointFixtureActorBinding[],
): ReadonlyMap<SuggestedWaypointWholePathRole, SuggestedWaypointFixtureActorBinding> {
  if (bindings.length !== ROLES.length) {
    throw new Error("whole_path_fixture_actor_cardinality");
  }

  const byRole = new Map<
    SuggestedWaypointWholePathRole,
    SuggestedWaypointFixtureActorBinding
  >();
  const authIds = new Set<string>();
  const emails = new Set<string>();

  for (const binding of bindings) {
    if (!ROLES.includes(binding.role)) {
      throw new Error("whole_path_fixture_unapproved_role");
    }
    if (!UUID.test(binding.authUserId)) {
      throw new Error("whole_path_fixture_invalid_auth_user_id");
    }
    if (!SYNTHETIC_EMAIL.test(binding.email)) {
      throw new Error("whole_path_fixture_invalid_synthetic_email");
    }
    if (
      byRole.has(binding.role) ||
      authIds.has(binding.authUserId) ||
      emails.has(binding.email)
    ) {
      throw new Error("whole_path_fixture_duplicate_actor_binding");
    }
    byRole.set(binding.role, Object.freeze({ ...binding }));
    authIds.add(binding.authUserId);
    emails.add(binding.email);
  }

  if (ROLES.some((role) => !byRole.has(role))) {
    throw new Error("whole_path_fixture_missing_actor_binding");
  }

  return byRole;
}

function valuesFor(
  byRole: ReadonlyMap<
    SuggestedWaypointWholePathRole,
    SuggestedWaypointFixtureActorBinding
  >,
  select: (
    role: SuggestedWaypointWholePathRole,
    binding: SuggestedWaypointFixtureActorBinding,
    ordinal: number,
  ) => readonly string[],
): string {
  return ROLES.map((role, index) => {
    const binding = byRole.get(role);
    if (!binding) {
      throw new Error("whole_path_fixture_missing_actor_binding");
    }
    return `(${select(role, binding, index).map(sqlText).join(", ")})`;
  }).join(",\n  ");
}

export function buildSuggestedWaypointLocalFixtureSql(
  bindings: readonly SuggestedWaypointFixtureActorBinding[],
): Readonly<{ sql: string; scenarioIds: SuggestedWaypointFixtureScenarioIds }> {
  const byRole = validateBindings(bindings);
  const metadata = JSON.stringify({
    fixture_id: SUGGESTED_WAYPOINT_FIXTURE_ID,
    fixture_scope: "local_whole_path_test_only",
    synthetic: true,
  });

  const accountValues = valuesFor(byRole, (role, binding) => [
    IDS.accounts[role],
    `SYNTHETIC ${role}`,
    binding.email,
    "active",
    "2026-01-01 00:00:00+00",
    metadata,
  ]);
  const assignmentValues = valuesFor(byRole, (role) => [
    IDS.assignments[role],
    IDS.accounts[role],
    role.endsWith("guide") ? "guide" : "explorer",
    "active",
    "system",
    "2026-01-01 00:00:00+00",
    metadata,
  ]);
  const providerValues = valuesFor(byRole, (role, binding) => [
    IDS.providerIdentities[role],
    IDS.accounts[role],
    "supabase",
    binding.authUserId,
    binding.email,
    "2026-01-01 00:00:00+00",
    "active",
    metadata,
  ]);
  const sessionValues = valuesFor(byRole, (role) => [
    IDS.sessions[role],
    IDS.accounts[role],
    role.endsWith("guide") ? "guide" : "explorer",
    "2026-01-01 00:00:00+00",
    "2099-01-01 00:00:00+00",
    "active",
    metadata,
  ]);
  const emails = ROLES.map((role) => sqlText(byRole.get(role)!.email)).join(", ");

  const sql = `\\set ON_ERROR_STOP on
begin;

do $fixture_preflight$
declare
  v_collision_count integer;
begin
  if pg_catalog.to_regclass('identity.user_account') is null
     or pg_catalog.to_regclass('identity.user_role_assignment') is null
     or pg_catalog.to_regclass('identity.auth_provider_identity') is null
     or pg_catalog.to_regclass('identity.user_session') is null
     or pg_catalog.to_regclass('core.organization') is null
     or pg_catalog.to_regclass('core.practice') is null
     or pg_catalog.to_regclass('core.guide_profile') is null
     or pg_catalog.to_regclass('core.explorer_profile') is null
     or pg_catalog.to_regclass('core.practice_guide') is null
     or pg_catalog.to_regclass('core.guide_explorer_relationship') is null then
    raise exception 'Lane G fixture requires the source-current identity/core schema';
  end if;

  select pg_catalog.count(*)::integer into v_collision_count
    from (
      select 1 from identity.user_account
       where user_account_id::text like '02208000-%'
          or metadata ->> 'fixture_id' = ${sqlText(SUGGESTED_WAYPOINT_FIXTURE_ID)}
          or pg_catalog.lower(username) in (${emails})
      union all
      select 1 from identity.user_role_assignment
       where user_role_assignment_id::text like '02208000-%'
          or metadata ->> 'fixture_id' = ${sqlText(SUGGESTED_WAYPOINT_FIXTURE_ID)}
      union all
      select 1 from identity.auth_provider_identity
       where auth_provider_identity_id::text like '02208000-%'
          or metadata ->> 'fixture_id' = ${sqlText(SUGGESTED_WAYPOINT_FIXTURE_ID)}
      union all
      select 1 from identity.user_session
       where user_session_id::text like '02208000-%'
          or metadata ->> 'fixture_id' = ${sqlText(SUGGESTED_WAYPOINT_FIXTURE_ID)}
      union all
      select 1 from core.organization
       where organization_id::text like '02208000-%'
          or metadata ->> 'fixture_id' = ${sqlText(SUGGESTED_WAYPOINT_FIXTURE_ID)}
      union all
      select 1 from core.practice
       where practice_id::text like '02208000-%'
          or metadata ->> 'fixture_id' = ${sqlText(SUGGESTED_WAYPOINT_FIXTURE_ID)}
      union all
      select 1 from core.guide_profile
       where guide_profile_id::text like '02208000-%'
          or metadata ->> 'fixture_id' = ${sqlText(SUGGESTED_WAYPOINT_FIXTURE_ID)}
      union all
      select 1 from core.explorer_profile
       where explorer_profile_id::text like '02208000-%'
          or metadata ->> 'fixture_id' = ${sqlText(SUGGESTED_WAYPOINT_FIXTURE_ID)}
      union all
      select 1 from core.practice_guide
       where practice_guide_id::text like '02208000-%'
          or metadata ->> 'fixture_id' = ${sqlText(SUGGESTED_WAYPOINT_FIXTURE_ID)}
      union all
      select 1 from core.guide_explorer_relationship
       where guide_explorer_relationship_id::text like '02208000-%'
          or metadata ->> 'fixture_id' = ${sqlText(SUGGESTED_WAYPOINT_FIXTURE_ID)}
    ) collision;

  if v_collision_count <> 0 then
    raise exception 'Lane G fixture collision';
  end if;
end;
$fixture_preflight$;

insert into identity.user_account
  (user_account_id, display_name, username, account_status, created_at, metadata)
values
  ${accountValues};

insert into identity.user_role_assignment
  (user_role_assignment_id, user_account_id, role_code, role_status, granted_by_role_context, granted_at, metadata)
values
  ${assignmentValues};

insert into identity.auth_provider_identity
  (auth_provider_identity_id, user_account_id, provider_name, provider_user_id, provider_email, linked_at, status, metadata)
values
  ${providerValues};

insert into identity.user_session
  (user_session_id, user_account_id, active_role_context, created_at, expires_at, session_status, metadata)
values
  ${sessionValues};

insert into core.organization
  (organization_id, organization_name, description, is_self, approval_status, status, created_at, created_by_user_account_id, metadata)
values (${sqlText(IDS.organization)}, 'SYNTHETIC Lane G Organization', 'Local whole-path fixture only.', true, 'draft', 'active', '2026-01-01 00:00:00+00', ${sqlText(IDS.accounts["assigned-guide"])}, ${sqlText(metadata)}::jsonb);

insert into core.practice
  (practice_id, organization_id, practice_name, description, is_self, same_as_organization, approval_status, status, created_at, created_by_user_account_id, metadata)
values (${sqlText(IDS.practice)}, ${sqlText(IDS.organization)}, 'SYNTHETIC Lane G Practice', 'Local whole-path fixture only.', true, true, 'draft', 'active', '2026-01-01 00:00:00+00', ${sqlText(IDS.accounts["assigned-guide"])}, ${sqlText(metadata)}::jsonb);

insert into core.guide_profile
  (guide_profile_id, user_account_id, guide_display_name, setup_status, created_at, status, metadata)
values
  (${sqlText(IDS.guides.assigned)}, ${sqlText(IDS.accounts["assigned-guide"])}, 'SYNTHETIC Assigned Guide', 'profile_pending', '2026-01-01 00:00:00+00', 'active', ${sqlText(metadata)}::jsonb),
  (${sqlText(IDS.guides.unrelated)}, ${sqlText(IDS.accounts["unrelated-guide"])}, 'SYNTHETIC Unrelated Guide', 'profile_pending', '2026-01-01 00:00:00+00', 'active', ${sqlText(metadata)}::jsonb);

insert into core.explorer_profile
  (explorer_profile_id, user_account_id, explorer_display_name, onboarding_status, preferred_contact_channel, created_at, status, metadata)
values
  (${sqlText(IDS.explorers.assigned)}, ${sqlText(IDS.accounts["assigned-explorer"])}, 'SYNTHETIC Assigned Explorer', 'intake_pending', 'in_app', '2026-01-01 00:00:00+00', 'active', ${sqlText(metadata)}::jsonb),
  (${sqlText(IDS.explorers.unrelated)}, ${sqlText(IDS.accounts["unrelated-explorer"])}, 'SYNTHETIC Unrelated Explorer', 'intake_pending', 'in_app', '2026-01-01 00:00:00+00', 'active', ${sqlText(metadata)}::jsonb),
  (${sqlText(IDS.explorers.ended)}, ${sqlText(IDS.accounts["ended-explorer"])}, 'SYNTHETIC Ended Explorer', 'ended', 'in_app', '2026-01-01 00:00:00+00', 'active', ${sqlText(metadata)}::jsonb);

insert into core.practice_guide
  (practice_guide_id, practice_id, guide_profile_id, relationship_status, is_primary_for_mvp0, created_at, created_by_user_account_id, metadata)
values
  (${sqlText(IDS.practiceGuides.assigned)}, ${sqlText(IDS.practice)}, ${sqlText(IDS.guides.assigned)}, 'active', true, '2026-01-01 00:00:00+00', ${sqlText(IDS.accounts["assigned-guide"])}, ${sqlText(metadata)}::jsonb),
  (${sqlText(IDS.practiceGuides.unrelated)}, ${sqlText(IDS.practice)}, ${sqlText(IDS.guides.unrelated)}, 'active', false, '2026-01-01 00:00:00+00', ${sqlText(IDS.accounts["assigned-guide"])}, ${sqlText(metadata)}::jsonb);

insert into core.guide_explorer_relationship
  (guide_explorer_relationship_id, guide_profile_id, explorer_profile_id, practice_id, relationship_status, started_at, ended_at, created_at, created_by_user_account_id, metadata)
values
  (${sqlText(IDS.relationships.assigned)}, ${sqlText(IDS.guides.assigned)}, ${sqlText(IDS.explorers.assigned)}, ${sqlText(IDS.practice)}, 'active', '2026-01-01 00:00:00+00', null, '2026-01-01 00:00:00+00', ${sqlText(IDS.accounts["assigned-guide"])}, ${sqlText(metadata)}::jsonb),
  (${sqlText(IDS.relationships.unrelated)}, ${sqlText(IDS.guides.unrelated)}, ${sqlText(IDS.explorers.unrelated)}, ${sqlText(IDS.practice)}, 'active', '2026-01-01 00:00:00+00', null, '2026-01-01 00:00:00+00', ${sqlText(IDS.accounts["unrelated-guide"])}, ${sqlText(metadata)}::jsonb),
  (${sqlText(IDS.relationships.ended)}, ${sqlText(IDS.guides.assigned)}, ${sqlText(IDS.explorers.ended)}, ${sqlText(IDS.practice)}, 'ended', '2026-01-01 00:00:00+00', '2026-01-02 00:00:00+00', '2026-01-01 00:00:00+00', ${sqlText(IDS.accounts["assigned-guide"])}, ${sqlText(metadata)}::jsonb);

do $fixture_policy$
begin
  update core.application_setting
     set integer_value = 60
   where application_setting_id = 'a30f0220-0000-4000-8000-000000000001'::uuid
     and setting_key = 'suggested_waypoint_send_grace_seconds'
     and minimum_integer_value = 60
     and default_integer_value = 300
     and maximum_integer_value = 3600;
  if not found then
    raise exception 'Lane G fixture send-grace policy unavailable';
  end if;
end;
$fixture_policy$;

do $fixture_post_setup$
declare
  v_fixture_id constant text := ${sqlText(SUGGESTED_WAYPOINT_FIXTURE_ID)};
begin
  if (select count(*) from identity.user_account where metadata ->> 'fixture_id' = v_fixture_id) <> 5
     or (select count(*) from identity.user_role_assignment where metadata ->> 'fixture_id' = v_fixture_id and role_status = 'active') <> 5
     or (select count(*) from identity.auth_provider_identity where metadata ->> 'fixture_id' = v_fixture_id and status = 'active') <> 5
     or (select count(*) from identity.user_session where metadata ->> 'fixture_id' = v_fixture_id and session_status = 'active') <> 5
     or (select count(*) from core.guide_profile where metadata ->> 'fixture_id' = v_fixture_id and status = 'active') <> 2
     or (select count(*) from core.explorer_profile where metadata ->> 'fixture_id' = v_fixture_id and status = 'active') <> 3
     or (select count(*) from core.guide_explorer_relationship where metadata ->> 'fixture_id' = v_fixture_id and relationship_status = 'active') <> 2
     or (select count(*) from core.guide_explorer_relationship where metadata ->> 'fixture_id' = v_fixture_id and relationship_status = 'ended') <> 1
     or (select integer_value from core.application_setting where setting_key = 'suggested_waypoint_send_grace_seconds') <> 60 then
    raise exception 'Lane G fixture cardinality validation failed';
  end if;
end;
$fixture_post_setup$;

commit;
`;

  return Object.freeze({
    sql,
    scenarioIds: Object.freeze({
      assignedRelationshipId: IDS.relationships.assigned,
      unrelatedRelationshipId: IDS.relationships.unrelated,
      endedRelationshipId: IDS.relationships.ended,
    }),
  });
}
