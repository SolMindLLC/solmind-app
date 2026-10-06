import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSuggestedWaypointWholePathGuideRelationshipEntryDiagnostic,
  SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_INTERNAL_STAGES,
} from "@/lib/solmind/supabase/suggestedWaypointWholePathGuideRelationshipEntryDiagnostic";

const RUN_ID = "S03G-20260829-relationship-r11";
const ORIGIN = "http://127.0.0.1:4321";
const RELATIONSHIP_ID = "44444444-4444-4444-8444-444444444444";

function setExactEnvironment(): void {
  vi.stubEnv(
    "SOLMIND_WHOLE_PATH_APPROVAL",
    "approved-local-synthetic-suggested-waypoint-whole-path",
  );
  vi.stubEnv(
    "SOLMIND_WHOLE_PATH_ALLOW_LOCAL_EFFECTS",
    "approved-exact-run-local-auth-and-database-cleanup",
  );
  vi.stubEnv("SOLMIND_WHOLE_PATH_RUN_ID", RUN_ID);
  vi.stubEnv("SOLMIND_LOCAL_SUPABASE_PROJECT_ID", "solmind-app");
  vi.stubEnv("SOLMIND_LOCAL_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("SOLMIND_LOCAL_DATABASE_PORT", "54322");
  vi.stubEnv("SOLMIND_TRUSTED_APP_ORIGIN", ORIGIN);
}

function request(
  overrides: Readonly<{
    method?: string;
    origin?: string;
    path?: string;
    runId?: string | null;
  }> = {},
): Request {
  const headers = new Headers();
  const runId = overrides.runId === undefined ? RUN_ID : overrides.runId;
  if (runId !== null) headers.set("x-solmind-whole-path-run-id", runId);
  return new Request(
    `${overrides.origin ?? ORIGIN}${overrides.path ?? `/guide/waypoint-suggestions/${RELATIONSHIP_ID}/suggestions?pageSize=10`}`,
    { method: overrides.method ?? "GET", headers },
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Suggested Waypoint whole-path Guide relationship-entry server diagnostic", () => {
  it("emits each fixed stage exactly once without retaining caller values", () => {
    setExactEnvironment();
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    for (const stage of SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_INTERNAL_STAGES) {
      const diagnostic =
        createSuggestedWaypointWholePathGuideRelationshipEntryDiagnostic(
          request(),
        );
      expect(diagnostic).not.toBeNull();
      diagnostic!.report(stage);
      diagnostic!.report(stage);
    }

    expect(write).toHaveBeenCalledTimes(
      SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_INTERNAL_STAGES.length,
    );
    expect(write.mock.calls.map(([value]) => value)).toEqual(
      SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_INTERNAL_STAGES.map(
        (stage) =>
          `whole_path_internal_guide_relationship_entry_${stage}\n`,
      ),
    );
    expect(JSON.stringify(write.mock.calls)).not.toContain(RELATIONSHIP_ID);
    expect(JSON.stringify(write.mock.calls)).not.toContain(RUN_ID);
  });

  it("retains only the last fixed resolution stage before denial", () => {
    setExactEnvironment();
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const diagnostic =
      createSuggestedWaypointWholePathGuideRelationshipEntryDiagnostic(
        request(),
      );

    diagnostic!.setResolutionStage("principal_denied");
    diagnostic!.setResolutionStage("auth_context_denied");
    diagnostic!.setResolutionStage("guide_role_denied");
    diagnostic!.setResolutionStage("relationship_load_denied");
    diagnostic!.setResolutionStage("relationship_access_denied");
    diagnostic!.setResolutionStage("rpc_denied");
    diagnostic!.reportResolutionDenied();

    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith(
      "whole_path_internal_guide_relationship_entry_rpc_denied\n",
    );
  });

  it.each([
    ["SOLMIND_WHOLE_PATH_APPROVAL", "wrong"],
    ["SOLMIND_WHOLE_PATH_ALLOW_LOCAL_EFFECTS", "wrong"],
    ["SOLMIND_WHOLE_PATH_RUN_ID", "wrong"],
    ["SOLMIND_LOCAL_SUPABASE_PROJECT_ID", "wrong"],
    ["SOLMIND_LOCAL_SUPABASE_URL", "http://127.0.0.1:54322"],
    ["SOLMIND_LOCAL_DATABASE_PORT", "54321"],
    ["SOLMIND_TRUSTED_APP_ORIGIN", "http://127.0.0.1:54321"],
  ])("stays inert when exact environment gate %s drifts", (name, value) => {
    setExactEnvironment();
    vi.stubEnv(name, value);
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    expect(
      createSuggestedWaypointWholePathGuideRelationshipEntryDiagnostic(
        request(),
      ),
    ).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  it.each([
    request({ method: "POST" }),
    request({ origin: "http://127.0.0.1:4322" }),
    request({ path: "/guide/waypoint-suggestions/not-the-route" }),
    request({ runId: null }),
    request({ runId: "S03G-20260829-different-r11" }),
  ])("stays inert when the exact request binding drifts %#", (candidate) => {
    setExactEnvironment();
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    expect(
      createSuggestedWaypointWholePathGuideRelationshipEntryDiagnostic(
        candidate,
      ),
    ).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });
});
