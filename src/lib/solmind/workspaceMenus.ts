// The signed-in workspace menu data: Paul's 2026-11-02 decisions (decision
// queue 14:07:48 and 22:19:17 CST). The Explorer menu is option A, the
// September 23 menu he accepted; the Guide menu is the August Guide menu. This
// file is presentation data only: the entries, the working destinations and,
// for an entry with no working screen yet, the one sentence that says what it
// will do. Only the signed-in lib files import it:
// explorerConversationConnectedScreen.ts (the conversation screen),
// explorerWorkspaceFrame.ts (the Explorer workspace frame on the other
// signed-in Explorer pages), explorerOverviewHome.ts (the Overview card
// links), guideWorkspaceFrame.ts (the Guide workspace frame) and
// guideDashboardHome.ts (the Guide Dashboard wording). The review route's
// parts use the labels leaf workspaceNavigation.ts and never reach
// routeAccess.ts.
//
// The Explorer sentences are the interim review drafts from
// explorerConversationScreen.ts without their "Not yet implemented:" prefix.
// Paul agreed to reuse them pending his review of the wording.

import { EXPLORER_HOME_ROUTE, GUIDE_HOME_ROUTE } from "./routeAccess";
import { NOT_YET_IMPLEMENTED, UNNAMED_GUIDE, VIRTUAL_GUIDE_SHORT, guideNotes } from "./explorerConversationScreen";
import { SOLMIND_TERMS } from "./terms";
import { withoutReviewPrefix, type ExplorerMenuId, type ExplorerSpaceId, type WorkspaceEntry } from "./workspaceNavigation";

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function working<Id extends string>(id: Id, label: string, href: string, description: string | null = null): WorkspaceEntry<Id> {
  return freeze({ id, label, description, href, explanation: null });
}

function notConnected<Id extends string>(id: Id, label: string, reviewNote: string): WorkspaceEntry<Id> {
  return freeze({ id, label, description: null, href: null, explanation: withoutReviewPrefix(reviewNote) });
}

// An entry not connected yet whose sentence is a new draft, not a review note.
function notConnectedDraft<Id extends string>(id: Id, label: string, sentence: string): WorkspaceEntry<Id> {
  return freeze({ id, label, description: null, href: null, explanation: sentence });
}

// Overview is the Explorer home. Conversations is the existing conversation
// list (today it lists ended conversations). Waypoints is the existing
// Waypoint Suggestions page.
export const EXPLORER_MENU: readonly WorkspaceEntry<ExplorerMenuId>[] = freeze([
  working("overview", "Overview", EXPLORER_HOME_ROUTE),
  working("conversations", "Conversations", "/explorer/conversations"),
  working("waypoints", "Waypoints", "/explorer/waypoints"),
  notConnected("settings", "Settings", NOT_YET_IMPLEMENTED.settings),
]);

// The conversation spaces, shown under Conversations when it is the current
// section. The screen receives no Guide name, so the Guide space says "your Guide".
export const EXPLORER_CONVERSATION_SPACES: readonly WorkspaceEntry<ExplorerSpaceId>[] = freeze([
  working(
    "virtualGuide",
    `With your ${VIRTUAL_GUIDE_SHORT}`,
    "/explorer/conversation",
    "Waypoint conversations, private to you",
  ),
  notConnected("guide", `With ${UNNAMED_GUIDE}`, guideNotes(UNNAMED_GUIDE).guideSpace),
  notConnected("newConversation", "Start a new conversation", NOT_YET_IMPLEMENTED.newConversation),
]);

// The Guide menu (Paul's August Guide menu, 2026-11-02 decisions).

const GUIDE = SOLMIND_TERMS.guideRole;
const EXPLORER = SOLMIND_TERMS.explorerRole;

// "Guide Assistant" without the product name, derived from the canonical
// term. Until assistant naming is built the menu says "Chat with your Guide
// Assistant" (Paul's choice); a signed-in screen never shows a sample name.
export const GUIDE_ASSISTANT_SHORT = SOLMIND_TERMS.guideAssistant.slice(SOLMIND_TERMS.productName.length + 1);

export type GuideMenuId = "dashboard" | "explorers" | "guideAssistant" | "appointments" | "archive";

// The Guide menu's names. The rail name is also the breadcrumb root on the
// Guide workspace pages. The Guide menu shows no entries under a section, so
// the spaces name only fills the shared shape and is never shown.
export const GUIDE_MENU_LABELS = freeze({
  rail: `${GUIDE} workspace`,
  phone: `${GUIDE} workspace menu`,
  heading: "Workspace",
  spaces: "Conversation spaces",
});

// Dashboard is the signed-in Guide home. The other four are not connected yet.
// Their sentences are new drafts adapted from Paul's August simulation, for
// his wording review (like the Explorer sentences above).
export const GUIDE_MENU: readonly WorkspaceEntry<GuideMenuId>[] = freeze([
  working("dashboard", "Dashboard", GUIDE_HOME_ROUTE),
  notConnectedDraft(
    "explorers",
    `${EXPLORER}s`,
    `${EXPLORER}s will list the ${EXPLORER}s you guide, so you can open each one's workspace to review shared information and your own ${GUIDE} activity.`,
  ),
  notConnectedDraft(
    "guideAssistant",
    `Chat with your ${GUIDE_ASSISTANT_SHORT}`,
    `This will open a ${GUIDE}-private conversation with your ${SOLMIND_TERMS.guideAssistant}, which uses only information in your ${GUIDE} workspace and cannot see what an ${EXPLORER} keeps private.`,
  ),
  notConnectedDraft("appointments", "Appointments", `Appointments will show your upcoming and recent ${EXPLORER} appointments.`),
  notConnectedDraft(
    "archive",
    "Archive",
    `Archive will hold items removed from your active ${GUIDE} lists; ${EXPLORER} records keep their own lifecycle.`,
  ),
]);

// The Guide's working Waypoint Suggestions pages, which no menu entry stands
// for: the Dashboard card links them and their breadcrumb names them.
export const GUIDE_WAYPOINT_SUGGESTIONS = freeze({
  label: "Waypoint Suggestions",
  href: "/guide/waypoint-suggestions",
});
