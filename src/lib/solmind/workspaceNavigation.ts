// The Explorer workspace menu labels for both conversation screens: Paul's
// 2026-11-02 Explorer menu option A, the September 23 menu he accepted
// (decision queue 14:07:48 and 22:19:17 CST). This leaf holds only the
// navigation names and list heading, the grey "Not connected yet" label, the
// helper that drops the review prefix from a sentence, and the entry types.
// It imports nothing but explorerConversationScreen.ts, so the review route's
// parts can use it without reaching any route or access module.
//
// The signed-in menu data with its destinations is in workspaceMenus.ts,
// which only explorerConversationConnectedScreen.ts imports. A Guide menu can
// be added there later in the same shape.

import { NOT_YET_IMPLEMENTED_PREFIX } from "./explorerConversationScreen";

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

// The grey line under an entry, or beside an area, that has no working screen yet.
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

// The navigation names and the list heading, as on September 23.
export const EXPLORER_MENU_LABELS = freeze({
  rail: "Explorer workspace",
  phone: "Explorer workspace menu",
  heading: "Workspace",
});
