import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  formatSuggestedWaypointDate,
  formatSuggestedWaypointDateTime,
} from "../suggestedWaypointDisplayDate";

const CENTRAL_TIME_ZONE = "America/Chicago";

describe("Suggested Waypoint display dates", () => {
  it("uses the viewer calendar date and always includes the year", () => {
    expect(
      formatSuggestedWaypointDate("2026-08-18T01:30:00.000Z", {
        timeZone: CENTRAL_TIME_ZONE,
      }),
    ).toBe("Aug 17, 2026");
  });

  it("keeps the prior local year across the December 31 boundary", () => {
    expect(
      formatSuggestedWaypointDate("2027-01-01T01:30:00.000Z", {
        timeZone: CENTRAL_TIME_ZONE,
      }),
    ).toBe("Dec 31, 2026");
  });

  it("renders local daylight and standard time without changing the calendar basis", () => {
    const summer = formatSuggestedWaypointDateTime("2026-08-18T14:30:00.000Z", {
      timeZone: CENTRAL_TIME_ZONE,
    });
    const winter = formatSuggestedWaypointDateTime("2026-01-18T15:30:00.000Z", {
      timeZone: CENTRAL_TIME_ZONE,
    });

    expect(summer).toMatch(/^Aug 18, 2026, 9:30 AM (?:CDT|GMT-5)$/);
    expect(winter).toMatch(/^Jan 18, 2026, 9:30 AM (?:CST|GMT-6)$/);
    expect(summer.startsWith(formatSuggestedWaypointDate("2026-08-18T14:30:00.000Z", {
      timeZone: CENTRAL_TIME_ZONE,
    }))).toBe(true);
  });

  it("fails loudly instead of displaying an invalid date", () => {
    expect(() => formatSuggestedWaypointDate("not-a-date")).toThrow(RangeError);
    expect(() => formatSuggestedWaypointDateTime("not-a-date")).toThrow(RangeError);
  });

  it("keeps all production consumers on the shared viewer-local owner", () => {
    const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
    const componentPaths = [
      "src/components/solmind/ExplorerSuggestedWaypointInbox.tsx",
      "src/components/solmind/ExplorerSuggestedWaypointDetail.tsx",
      "src/components/solmind/GuideSuggestedWaypointRelationshipList.tsx",
      "src/components/solmind/GuideSuggestedWaypointDetail.tsx",
    ];

    for (const componentPath of componentPaths) {
      const source = readFileSync(resolve(repositoryRoot, componentPath), "utf8");
      expect(source).toContain("@/lib/solmind/suggestedWaypointDisplayDate");
      expect(source).not.toContain('timeZone: "UTC"');
      expect(source).not.toMatch(/function formatDate(?:Time)?\(/);
    }
  });
});
