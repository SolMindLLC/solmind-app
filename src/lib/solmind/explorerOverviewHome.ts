// Fixed wording for the signed-in Explorer home, Overview (Paul's 2026-11-02
// decisions, decision queue 14:07:48 and 22:19:17 CST: "Mockup cards, no
// names"). It is the Option A home mockup's wording without names or counts:
// only session times reach the home (ExplorerHome.tsx), so it says "your
// Virtual Guide" and "your Guide". The card links reuse the shared menu's
// destinations; the "can see" action is not connected yet and reuses its
// review sentence (NOT_YET_IMPLEMENTED.virtualGuideCanSee) without the prefix.

import { SOLMIND_TERMS } from "./terms";
import { UNNAMED_GUIDE, VIRTUAL_GUIDE_SHORT } from "./explorerConversationScreen";
import { EXPLORER_CONVERSATION_SPACES, EXPLORER_MENU } from "./workspaceMenus";

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

const VG = VIRTUAL_GUIDE_SHORT;

// The destination of a working menu entry.
function destination(entries: readonly Readonly<{ id: string; href: string | null }>[], id: string): string {
  const href = entries.find((entry) => entry.id === id)?.href;
  if (href === undefined || href === null) throw new Error("overview_destination_missing");
  return href;
}

// The page heading, which the skip control and the Overview entry focus.
export const OVERVIEW_HEADING_ID = "explorer-overview-heading";

export const EXPLORER_OVERVIEW = freeze({
  eyebrow: "Welcome back",
  title: `Take a quiet moment with your ${VG}`,
  subtitle: `A conversation with your ${VG} can help you reflect and notice what matters. A Waypoint may take shape if something meaningful emerges, and there is no pressure to create one.`,
  begin: freeze({
    title: `Begin with your ${VG}`,
    badge: "AI",
    body: `Your ${SOLMIND_TERMS.virtualGuide} is AI. This conversation is private unless you later choose exactly what to share.`,
    talk: `Talk with your ${VG}`,
    talkHref: destination(EXPLORER_CONVERSATION_SPACES, "virtualGuide"),
    canSee: `Learn what your ${VG} can see`,
  }),
  suggestions: freeze({
    title: "Waypoint Suggestions",
    body: `Suggestions from ${UNNAMED_GUIDE} appear in Waypoints. You decide whether any become part of your private Waypoint work.`,
    open: "Open suggestions",
    openHref: destination(EXPLORER_MENU, "waypoints"),
  }),
  signOut: "Sign out",
  signingOut: "Signing out...",
});
