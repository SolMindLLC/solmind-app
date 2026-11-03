// The Admin workspace frame data for the minimal functional Admin screens
// (PRJ01_R-WS03-WI014; decision queue 2026-11-03 11:52:57, 11:56:14 and
// 12:19:09): the Admin menu, its names, the breadcrumb root and the profile
// role. The role-neutral frame (WorkspaceFrame.tsx) takes this data as props,
// as it takes the Explorer's and the Guide's. Presentation data only. The menu
// has exactly the four working screens Paul approved, with no placeholders:
// Dashboard (the signed-in Admin home), Guides and Explorers, AI use and
// pauses, and Settings. Each entry is a plain full-document link, so the server
// checks access again on every page. No page receives a name, so the profile
// chip shows the role with the shield icon and its existing "Not connected yet"
// treatment. This file stays apart from workspaceMenus.ts, whose importers are a
// fixed list. Paul may throw these screens away and replace the design.

import type { AdminWorkspacePageName } from "./adminWorkspaceContract";
import { UNNAMED_GUIDE } from "./explorerConversationScreen";
import type { ScreenNavigationItem, WorkspaceFrameData } from "./explorerConversationScreenDisplay";
import { ADMIN_AI_USE_ROUTE, ADMIN_HOME_ROUTE, ADMIN_PEOPLE_ROUTE, ADMIN_SETTINGS_ROUTE } from "./routeAccess";
import { SOLMIND_TERMS } from "./terms";
import type { WorkspaceEntry } from "./workspaceNavigation";

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

const ADMIN = SOLMIND_TERMS.adminRole;

// The menu entry ids are the page names (menu icons are keyed by them).
function working(id: AdminWorkspacePageName, label: string, href: string): WorkspaceEntry<AdminWorkspacePageName> {
  return freeze({ id, label, description: null, href, explanation: null });
}

// The Admin menu's names, as the Guide's ("Guide workspace", "Guide workspace
// menu"). The rail name is also the breadcrumb root and every page's eyebrow.
// The Admin menu shows no entries under a section, so the spaces name only
// fills the shared shape and is never shown.
export const ADMIN_MENU_LABELS = freeze({
  rail: `${ADMIN} workspace`,
  phone: `${ADMIN} workspace menu`,
  heading: "Workspace",
  spaces: "Conversation spaces",
});

export const ADMIN_MENU: readonly WorkspaceEntry<AdminWorkspacePageName>[] = freeze([
  working("dashboard", "Dashboard", ADMIN_HOME_ROUTE),
  working("people", `${SOLMIND_TERMS.guideRole}s and ${SOLMIND_TERMS.explorerRole}s`, ADMIN_PEOPLE_ROUTE),
  working("aiUse", "AI use and pauses", ADMIN_AI_USE_ROUTE),
  working("settings", "Settings", ADMIN_SETTINGS_ROUTE),
]);

// One frame per page: that page's entry is the current page.
function frame(page: AdminWorkspacePageName): WorkspaceFrameData {
  const navigation: readonly ScreenNavigationItem[] = freeze(
    ADMIN_MENU.map((entry) => freeze({ ...entry, current: entry.id === page ? "page" : false })),
  );
  return freeze({
    labels: ADMIN_MENU_LABELS,
    breadcrumbRoot: ADMIN_MENU_LABELS.rail,
    navigation,
    spaces: freeze([]),
    profile: freeze({ name: "", role: ADMIN, icon: "admin" }),
    // Unused by signed-in entries; kept only for the shared menu's review notes.
    guideName: UNNAMED_GUIDE,
  });
}

export const ADMIN_WORKSPACE_FRAMES: Readonly<Record<AdminWorkspacePageName, WorkspaceFrameData>> = freeze({
  dashboard: frame("dashboard"),
  people: frame("people"),
  aiUse: frame("aiUse"),
  settings: frame("settings"),
});
