import { describe, expect, it } from "vitest";

import { projectSuggestedWaypointForExplorer } from "../suggestedWaypoints";
import {
  createDeliveredSuggestedWaypointFixture,
  createExplorerSuggestedWaypointFixture,
} from "../suggestedWaypointFixtures";

describe("Explorer Suggested Waypoint fixture", () => {
  it("creates one delivered unread Explorer projection without Guide-only state", () => {
    const fixture = createDeliveredSuggestedWaypointFixture();
    const projection = projectSuggestedWaypointForExplorer(fixture);
    const serialized = JSON.stringify(projection);

    expect(projection?.currentVersion.content.destination).toBe(
      "Protect one evening each week for recovery",
    );
    expect(projection?.read).toBe(false);
    expect(serialized).not.toContain("pendingDeadlineMs");
    expect(serialized).not.toContain("pullBackAvailable");
    expect(serialized).not.toContain("policyVersion");
    expect(serialized).not.toContain("guideUserId");
  });

  it("backs the Mary-attributed possible-connection cue with one immutable observation", () => {
    const fixture = createExplorerSuggestedWaypointFixture();

    expect(fixture.possibleConnection.source).toBe("virtual-guide");
    expect(fixture.possibleConnection.assistantDisplayName).toBe("Mary");
    expect(fixture.possibleConnection.candidateWaypointIds).toHaveLength(2);
    expect(Object.isFrozen(fixture.possibleConnection)).toBe(true);
    expect(Object.isFrozen(fixture.possibleConnection.candidateWaypointIds)).toBe(
      true,
    );
  });
});
