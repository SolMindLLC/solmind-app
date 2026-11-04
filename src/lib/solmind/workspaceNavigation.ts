// The Explorer workspace menu labels for both conversation screens: Paul's
// 2026-11-02 Explorer menu option A, the September 23 menu he accepted
// (decision queue 14:07:48 and 22:19:17 CST). This leaf holds only the
// navigation names and list heading, the "Not connected yet" label, the
// helper that drops the review prefix from a sentence, and the entry types.
// It imports nothing but explorerConversationScreen.ts, so the review route's
// parts can use it without reaching any route or access module.
//
// The signed-in menu data with its destinations is in workspaceMenus.ts,
// which only the signed-in lib files import (explorerConversationConnectedScreen.ts,
// explorerWorkspaceFrame.ts, explorerOverviewHome.ts, guideWorkspaceFrame.ts
// and guideDashboardHome.ts). The Guide menu's names live there too, with its
// entries: only signed-in Guide pages use them, and they take the role words
// from terms.ts, which this leaf does not import.

import { NOT_YET_IMPLEMENTED_PREFIX } from "./explorerConversationScreen";

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

// The label on an entry or control, or at the head of an area's build-note box, that has
// no working screen yet: a build note in the reserved blue since 2026-11-03 (Paul's rule).
export const WORKSPACE_NOT_CONNECTED_LABEL = "Not connected yet";

// A review sentence without its "Not yet implemented: " prefix.
export function withoutReviewPrefix(note: string): string {
  const prefix = `${NOT_YET_IMPLEMENTED_PREFIX} `;
  if (!note.startsWith(prefix)) throw new Error("review_prefix_missing");
  return note.slice(prefix.length);
}

// An entry opens a working screen (href), or is not connected yet (href null)
// and has the sentence that says what it will do (explanation). description
// is the optional second line under a working entry's label.
export type WorkspaceEntry<Id extends string> =
  | Readonly<{ id: Id; label: string; description: string | null; href: string; explanation: null }>
  | Readonly<{ id: Id; label: string; description: null; href: null; explanation: string }>;

export type ExplorerMenuId = "overview" | "conversations" | "waypoints" | "settings";
export type ExplorerSpaceId = "virtualGuide" | "guide" | "newConversation";

// The navigation names and the list heading, as on September 23, and the name
// of the list of conversation spaces under Conversations. The rail name is
// also the breadcrumb root on the Explorer workspace pages.
export const EXPLORER_MENU_LABELS = freeze({
  rail: "Explorer workspace",
  phone: "Explorer workspace menu",
  heading: "Workspace",
  spaces: "Conversation spaces",
});
