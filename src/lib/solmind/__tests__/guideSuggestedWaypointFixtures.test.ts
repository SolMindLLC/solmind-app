import { describe, expect, it } from "vitest";

import {
  createGuideSuggestedWaypointFixtures,
  GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS,
} from "../guideSuggestedWaypointFixtures";
import {
  projectSuggestedWaypointForExplorer,
  projectSuggestedWaypointForGuide,
  pullBackSuggestedWaypoint,
} from "../suggestedWaypoints";

describe("Guide Suggested Waypoint fixtures", () => {
  it("keeps draft and pending content absent from the Explorer projection", () => {
    const fixtures = createGuideSuggestedWaypointFixtures();

    expect(projectSuggestedWaypointForExplorer(fixtures.draft)).toBeNull();
    expect(projectSuggestedWaypointForExplorer(fixtures.pending)).toBeNull();
    expect(projectSuggestedWaypointForGuide(fixtures.pending, GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS)).toMatchObject({
      authoringMode: "pending",
      channelStatus: "not-delivered",
      pullBackAvailable: true,
    });
  });

  it("returns a pending send to an editable draft during grace", () => {
    const { pending } = createGuideSuggestedWaypointFixtures();
    const result = pullBackSuggestedWaypoint(
      pending,
      GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 30_000,
    );

    expect(result.kind).toBe("applied");
    if (result.kind === "applied") {
      expect(result.state.authoring).toMatchObject({ mode: "draft", revision: 2 });
      expect(projectSuggestedWaypointForExplorer(result.state)).toBeNull();
    }
  });

  it("shows delivered content without inventing an Explorer response", () => {
    const { open } = createGuideSuggestedWaypointFixtures();
    const projection = projectSuggestedWaypointForGuide(
      open,
      GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 600_000,
    );

    expect(projection.channelStatus).toBe("open");
    expect(projection.currentVersion?.content.destination).toBe(
      "Notice what makes a meeting feel useful",
    );
    expect(projection.receipts).toHaveLength(0);
    expect(projection.responses).toHaveLength(0);
  });

  it("shows only the deliberately supplied receipt acknowledgement", () => {
    const { acknowledged } = createGuideSuggestedWaypointFixtures();
    const projection = projectSuggestedWaypointForGuide(
      acknowledged,
      GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 900_000,
    );

    expect(projection.receipts).toEqual([
      {
        versionId: "suggestion-monday-acknowledged-v1",
        acknowledgedAtMs: GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 600_000,
      },
    ]);
    expect("read" in projection).toBe(false);
    expect("privateDraftsByVersion" in projection).toBe(false);
    expect("usedVersionIds" in projection).toBe(false);
  });

  it("deep-freezes every fixture state", () => {
    const fixtures = createGuideSuggestedWaypointFixtures();

    for (const state of Object.values(fixtures)) {
      expect(Object.isFrozen(state)).toBe(true);
      expect(Object.isFrozen(state.authoring)).toBe(true);
      if (state.channel) {
        expect(Object.isFrozen(state.channel)).toBe(true);
        expect(Object.isFrozen(state.channel.versions)).toBe(true);
      }
    }
  });
});
