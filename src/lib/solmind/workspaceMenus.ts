// The Explorer menu data on the signed-in conversation screen: Paul's
// 2026-11-02 Explorer menu option A, the September 23 menu he accepted
// (decision queue 14:07:48 and 22:19:17 CST). This file is presentation data
// only: the entries, the working destinations and, for an entry with no
// working screen yet, the one sentence that says what it will do. Only
// explorerConversationConnectedScreen.ts imports it; the review route's parts
// use the labels leaf workspaceNavigation.ts and never reach routeAccess.ts.
// A Guide menu can be added here later in the same shape.
//
// The sentences are the interim review drafts from explorerConversationScreen.ts
// without their "Not yet implemented:" prefix. Paul agreed to reuse them
// pending his review of the wording.

import { EXPLORER_HOME_ROUTE } from "./routeAccess";
import { NOT_YET_IMPLEMENTED, UNNAMED_GUIDE, VIRTUAL_GUIDE_SHORT, guideNotes } from "./explorerConversationScreen";
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
