// The Explorer workspace frame data for the signed-in Explorer pages other
// than the conversation screen (Paul's 2026-11-02 decisions, decision queue
// 14:07:48 and 22:19:17 CST): the shared Explorer menu from workspaceMenus.ts
// with each page's section current, the breadcrumb root and the profile role.
// The frame component (WorkspaceFrame.tsx) is role-neutral and takes this
// data as props. Presentation data only; no page receives a name.

import { SOLMIND_TERMS } from "./terms";
import { UNNAMED_GUIDE } from "./explorerConversationScreen";
import type {
  ScreenConversationSpace,
  ScreenNavigationItem,
  WorkspaceFrameData,
} from "./explorerConversationScreenDisplay";
import { EXPLORER_CONVERSATION_SPACES, EXPLORER_MENU } from "./workspaceMenus";
import { EXPLORER_MENU_LABELS, type ExplorerMenuId } from "./workspaceNavigation";

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

// overview is the Explorer home (/explorer/home), conversations the
// conversation list (/explorer/conversations), waypoints the Waypoint
// Suggestions page (/explorer/waypoints) and waypointDetail one suggestion
// (/explorer/waypoints/[id]).
export type ExplorerWorkspacePage = "overview" | "conversations" | "waypoints" | "waypointDetail";

// Each page's section, and whether the page is that section's own page (its
// entry is then the current page) or a page inside it.
const PAGE_SECTIONS: Readonly<Record<ExplorerWorkspacePage, Readonly<{ section: ExplorerMenuId; ownPage: boolean }>>> =
  freeze({
    overview: freeze({ section: "overview", ownPage: true }),
    conversations: freeze({ section: "conversations", ownPage: true }),
    waypoints: freeze({ section: "waypoints", ownPage: true }),
    waypointDetail: freeze({ section: "waypoints", ownPage: false }),
  });

function frame(page: ExplorerWorkspacePage): WorkspaceFrameData {
  const { section, ownPage } = PAGE_SECTIONS[page];
  const navigation: readonly ScreenNavigationItem[] = freeze(
    EXPLORER_MENU.map((entry) => freeze({ ...entry, current: entry.id !== section ? false : ownPage ? "page" : true })),
  );
  // The conversation spaces show under Conversations only. On the conversation
  // list no space is the current page.
  const spaces: readonly ScreenConversationSpace[] =
    section === "conversations"
      ? freeze(EXPLORER_CONVERSATION_SPACES.map((space) => freeze({ ...space, current: false })))
      : freeze([]);

  return freeze({
    labels: EXPLORER_MENU_LABELS,
    breadcrumbRoot: EXPLORER_MENU_LABELS.rail,
    navigation,
    spaces,
    profile: freeze({ name: "", role: SOLMIND_TERMS.explorerRole }),
    guideName: UNNAMED_GUIDE,
  });
}

export const EXPLORER_WORKSPACE_FRAMES: Readonly<Record<ExplorerWorkspacePage, WorkspaceFrameData>> = freeze({
  overview: frame("overview"),
  conversations: frame("conversations"),
  waypoints: frame("waypoints"),
  waypointDetail: frame("waypointDetail"),
});
