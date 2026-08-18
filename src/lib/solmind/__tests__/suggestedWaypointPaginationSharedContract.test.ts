import { describe, expect, it } from "vitest";

import {
  SUGGESTED_WAYPOINT_DEFAULT_PAGE_SIZE,
  SUGGESTED_WAYPOINT_PAGE_SIZES,
  isSuggestedWaypointOpaqueCursor,
  isSuggestedWaypointPageSize,
  parseSuggestedWaypointPaginationSearchParams,
} from "../suggestedWaypointPaginationSharedContract";

describe("Suggested Waypoint shared pagination contract", () => {
  it("freezes the exact Pilot 1 page sizes and default", () => {
    expect(SUGGESTED_WAYPOINT_PAGE_SIZES).toEqual([5, 10, 20, 50, 100]);
    expect(Object.isFrozen(SUGGESTED_WAYPOINT_PAGE_SIZES)).toBe(true);
    expect(SUGGESTED_WAYPOINT_DEFAULT_PAGE_SIZE).toBe(10);
    expect([5, 10, 20, 50, 100].map(isSuggestedWaypointPageSize)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(isSuggestedWaypointPageSize(0)).toBe(false);
    expect(isSuggestedWaypointPageSize(101)).toBe(false);
    expect(isSuggestedWaypointPageSize("10")).toBe(false);
  });

  it.each(["YWJjZGVm", "YWJjZGU=", "YWJjZA==", "AAAA".repeat(128)])(
    "accepts canonical padded Base64 cursor syntax: %s",
    (cursor) => {
      expect(isSuggestedWaypointOpaqueCursor(cursor)).toBe(true);
    },
  );

  it.each([
    "",
    "YQ",
    "YW=J",
    "YQ===",
    "YWJjZA__",
    "AAAA".repeat(129),
  ])("rejects malformed or overlong cursor syntax", (cursor) => {
    expect(isSuggestedWaypointOpaqueCursor(cursor)).toBe(false);
  });

  it("parses only the exact query contract and freezes the result", () => {
    const defaults = parseSuggestedWaypointPaginationSearchParams(
      new URLSearchParams(),
    );
    expect(defaults).toEqual({ pageSize: 10, cursor: null });
    expect(Object.isFrozen(defaults)).toBe(true);

    const explicit = parseSuggestedWaypointPaginationSearchParams(
      new URLSearchParams("pageSize=20&cursor=YWJjZA%3D%3D"),
    );
    expect(explicit).toEqual({ pageSize: 20, cursor: "YWJjZA==" });
    expect(Object.isFrozen(explicit)).toBe(true);
  });

  it.each([
    "pageSize=10&pageSize=20",
    "cursor=YWJjZA%3D%3D&cursor=YWJjZGU%3D",
    "unknown=value",
    "pageSize=010",
    "pageSize=25",
    "cursor=YQ",
  ])("rejects ambiguous, widened, or noncanonical query input: %s", (query) => {
    expect(
      parseSuggestedWaypointPaginationSearchParams(new URLSearchParams(query)),
    ).toBeNull();
  });
});
