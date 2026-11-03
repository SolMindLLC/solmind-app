// The Guide workspace frame data for the signed-in Guide pages (Paul's
// 2026-11-02 decisions, decision queue 14:07:48 and 22:19:17 CST): the August
// Guide menu from workspaceMenus.ts, the breadcrumb root and the profile role.
// The role-neutral frame (WorkspaceFrame.tsx) takes this data as props, the
// same way it takes the Explorer's. Presentation data only; no page receives a
// name, so the profile chip shows the role with a person icon.

import { SOLMIND_TERMS } from "./terms";
import { UNNAMED_GUIDE } from "./explorerConversationScreen";
import type { ScreenNavigationItem, WorkspaceFrameData } from "./explorerConversationScreenDisplay";
import { GUIDE_MENU, GUIDE_MENU_LABELS, GUIDE_WAYPOINT_SUGGESTIONS } from "./workspaceMenus";

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

// dashboard is the Guide home (/guide/home); waypointSuggestions is any of
// the three Guide Waypoint Suggestions pages under /guide/waypoint-suggestions,
// which no menu entry stands for.
export type GuideWorkspacePage = "dashboard" | "waypointSuggestions";

function frame(page: GuideWorkspacePage): WorkspaceFrameData {
  // On the Dashboard its entry is the current page; on the Waypoint
  // Suggestions pages no entry is current and the breadcrumb names the page.
  const navigation: readonly ScreenNavigationItem[] = freeze(
    GUIDE_MENU.map((entry) => freeze({ ...entry, current: page === "dashboard" && entry.id === "dashboard" ? "page" : false })),
  );
  const shared = {
    labels: GUIDE_MENU_LABELS,
    breadcrumbRoot: GUIDE_MENU_LABELS.rail,
    navigation,
    spaces: freeze([]),
    profile: freeze({ name: "", role: SOLMIND_TERMS.guideRole, icon: "guide" }),
    // Unused by signed-in entries; kept only for the shared menu's review notes.
    guideName: UNNAMED_GUIDE,
  };

  return page === "dashboard" ? freeze(shared) : freeze({ ...shared, breadcrumbPage: GUIDE_WAYPOINT_SUGGESTIONS.label });
}

export const GUIDE_WORKSPACE_FRAMES: Readonly<Record<GuideWorkspacePage, WorkspaceFrameData>> = freeze({
  dashboard: frame("dashboard"),
  waypointSuggestions: frame("waypointSuggestions"),
});
