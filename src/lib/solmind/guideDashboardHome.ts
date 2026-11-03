// Fixed wording for the signed-in Guide home, the Dashboard (Paul's
// 2026-11-02 decisions, decision queue 14:07:48 and 22:19:17 CST: "Mockup
// cards, no names"). It is the Guide dashboard mockup's wording without names,
// counts or sample times: only session times reach the Guide home
// (GuideHome.tsx). The SolMind Guide Assistant always reads as AI: its card
// carries the "AI" badge and says so. Each card button that has no working
// screen yet reuses its menu entry's sentence; "View Waypoint Suggestions"
// links the existing Guide Waypoint Suggestions page. The card texts are
// adapted from the mockup and Paul's August simulation, for his wording review.

import { SOLMIND_TERMS } from "./terms";
import { GUIDE_ASSISTANT_SHORT, GUIDE_MENU, GUIDE_MENU_LABELS, GUIDE_WAYPOINT_SUGGESTIONS, type GuideMenuId } from "./workspaceMenus";

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

const GUIDE = SOLMIND_TERMS.guideRole;
const EXPLORER = SOLMIND_TERMS.explorerRole;

// A menu entry that is not connected yet: its label and its sentence.
function menuEntry(id: GuideMenuId): Readonly<{ label: string; explanation: string }> {
  const entry = GUIDE_MENU.find((item) => item.id === id);
  if (entry === undefined || entry.explanation === null) throw new Error("guide_dashboard_entry_missing");
  return entry;
}

// The page heading, which the skip control and the Dashboard entry focus.
export const GUIDE_DASHBOARD_HEADING_ID = "guide-dashboard-heading";

export const GUIDE_DASHBOARD = freeze({
  eyebrow: GUIDE_MENU_LABELS.rail,
  title: "Welcome back",
  subtitle: "The people and work that may need your attention today.",
  explorers: freeze({
    title: `${EXPLORER}s`,
    body: `Open an ${EXPLORER}'s workspace to review shared information and your own ${GUIDE} activity.`,
    action: `Open ${EXPLORER}s`,
    explanation: menuEntry("explorers").explanation,
  }),
  assistant: freeze({
    title: GUIDE_ASSISTANT_SHORT,
    badge: "AI",
    body: `Your ${SOLMIND_TERMS.guideAssistant} is AI. Start a ${GUIDE}-private conversation that uses only information in your ${GUIDE} workspace.`,
    action: menuEntry("guideAssistant").label,
    explanation: menuEntry("guideAssistant").explanation,
  }),
  appointment: freeze({
    title: "Next appointment",
    body: "No calendar is connected yet.",
    action: "Open appointments",
    explanation: menuEntry("appointments").explanation,
  }),
  suggestions: freeze({
    title: GUIDE_WAYPOINT_SUGGESTIONS.label,
    body: `Each ${EXPLORER} decides whether a suggestion becomes part of their own Waypoint work.`,
    action: `View ${GUIDE_WAYPOINT_SUGGESTIONS.label}`,
    href: GUIDE_WAYPOINT_SUGGESTIONS.href,
  }),
  signOut: "Sign out",
  signingOut: "Signing out...",
});
