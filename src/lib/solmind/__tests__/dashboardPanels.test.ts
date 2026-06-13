import { describe, expect, it } from "vitest";

import {
  SOLMIND_ADMIN_DASHBOARD_PANELS,
  SOLMIND_GUIDE_DASHBOARD_PANELS,
} from "../dashboardPanels";

describe("dashboard panel role boundaries", () => {
  it("keeps Admin dashboard panels scoped to Admin", () => {
    expect(SOLMIND_ADMIN_DASHBOARD_PANELS).toHaveLength(3);
    expect(SOLMIND_ADMIN_DASHBOARD_PANELS.every((panel) => panel.role === "admin")).toBe(true);
    expect(SOLMIND_ADMIN_DASHBOARD_PANELS.map((panel) => panel.title)).toEqual([
      "Guide Invites",
      "Methodology",
      "System QA",
    ]);
  });

  it("keeps Guide dashboard panels scoped to Guide", () => {
    expect(SOLMIND_GUIDE_DASHBOARD_PANELS).toHaveLength(3);
    expect(SOLMIND_GUIDE_DASHBOARD_PANELS.every((panel) => panel.role === "guide")).toBe(true);
    expect(SOLMIND_GUIDE_DASHBOARD_PANELS.map((panel) => panel.title)).toEqual([
      "Active Explorers",
      "Needs Review",
      "Safety Flags",
    ]);
  });
});
