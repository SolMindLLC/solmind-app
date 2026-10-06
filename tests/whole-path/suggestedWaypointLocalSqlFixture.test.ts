import { describe, expect, it } from "vitest";

import type { SuggestedWaypointWholePathRole } from "./suggestedWaypointWholePathSafety";
import {
  buildSuggestedWaypointLocalFixtureSql,
  SUGGESTED_WAYPOINT_FIXTURE_ID,
  type SuggestedWaypointFixtureActorBinding,
} from "./suggestedWaypointLocalSqlFixture";

const ROLES = [
  "assigned-guide",
  "assigned-explorer",
  "unrelated-guide",
  "unrelated-explorer",
  "ended-explorer",
] as const satisfies readonly SuggestedWaypointWholePathRole[];

function bindings(): SuggestedWaypointFixtureActorBinding[] {
  return ROLES.map((role, index) => ({
    role,
    authUserId: `1000000${index}-0000-4000-8000-00000000000${index}`,
    email: `s03g-20260822-fixture.${role}@synthetic.invalid`,
  }));
}

describe("Suggested Waypoint local SQL fixture", () => {
  it("builds one transactional five-actor source-current graph", () => {
    const fixture = buildSuggestedWaypointLocalFixtureSql(bindings());

    expect(fixture.sql).toContain("\\set ON_ERROR_STOP on\nbegin;");
    expect(fixture.sql).toContain("insert into identity.user_account");
    expect(fixture.sql).toContain("insert into identity.user_role_assignment");
    expect(fixture.sql).toContain("insert into identity.auth_provider_identity");
    expect(fixture.sql).toContain("insert into identity.user_session");
    expect(fixture.sql).toContain("insert into core.guide_profile");
    expect(fixture.sql).toContain("insert into core.explorer_profile");
    expect(fixture.sql).toContain("insert into core.practice_guide");
    expect(fixture.sql).toContain("insert into core.guide_explorer_relationship");
    expect(fixture.sql).toContain(SUGGESTED_WAYPOINT_FIXTURE_ID);
    expect(fixture.sql).toContain("relationship_status = 'active') <> 2");
    expect(fixture.sql).toContain("relationship_status = 'ended') <> 1");
    expect(fixture.sql).toContain("set integer_value = 60");
    expect(fixture.sql).toContain("default_integer_value = 300");
    expect(fixture.sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("retains only the three scenario-local relationship identifiers", () => {
    expect(buildSuggestedWaypointLocalFixtureSql(bindings()).scenarioIds).toEqual({
      assignedRelationshipId: "02208000-5000-4000-8000-000000000001",
      unrelatedRelationshipId: "02208000-5000-4000-8000-000000000002",
      endedRelationshipId: "02208000-5000-4000-8000-000000000003",
    });
  });

  it.each([
    ["missing actor", () => bindings().slice(1)],
    ["duplicate role", () => bindings().map((actor, index) => index === 4 ? { ...actor, role: "assigned-guide" as const } : actor)],
    ["duplicate Auth UUID", () => bindings().map((actor, index, all) => index === 4 ? { ...actor, authUserId: all[0]!.authUserId } : actor)],
    ["duplicate email", () => bindings().map((actor, index, all) => index === 4 ? { ...actor, email: all[0]!.email } : actor)],
    ["hostile email", () => bindings().map((actor, index) => index === 4 ? { ...actor, email: "x@synthetic.invalid'; rollback; --" } : actor)],
    ["invalid Auth UUID", () => bindings().map((actor, index) => index === 4 ? { ...actor, authUserId: "not-a-uuid" } : actor)],
  ])("rejects %s before producing SQL", (_label, create) => {
    expect(() => buildSuggestedWaypointLocalFixtureSql(create())).toThrow(
      /whole_path_fixture_/,
    );
  });

  it("never emits selective cleanup or bypass statements", () => {
    const sql = buildSuggestedWaypointLocalFixtureSql(bindings()).sql.toLowerCase();
    expect(sql).not.toContain("session_replication_role");
    expect(sql).not.toContain("disable trigger");
    expect(sql).not.toContain("truncate ");
    expect(sql).not.toContain("delete from auth.");
  });
});
