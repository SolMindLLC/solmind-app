// Fixed wording and display data for the connected /explorer/conversation
// screen: Paul's designed layout (the S01R2 look, Jade rail navigation and the
// wireframe v6 structure first reviewed at /explorer/conversation-preview)
// showing the Explorer's real saved conversation.
//
// Nothing here is sample content and nothing here is private: the saved
// conversation itself arrives only through the authenticated feature route
// and is rendered by ExplorerConversation.tsx. Parts that are not connected
// yet keep their "Not yet implemented:" notes from explorerConversationScreen.ts.
// The connected screen does not receive the Explorer's or the Guide's name, so
// it shows the Explorer role and says "your Guide".

import { SOLMIND_TERMS } from "./terms";
import { MIDDLE_DOT, UNNAMED_GUIDE, VIRTUAL_GUIDE_SHORT } from "./explorerConversationScreen";
import type {
  ScreenConversationSpace,
  ScreenGuideBanner,
  ScreenNavigationItem,
  ScreenShellData,
  ScreenSpeaker,
} from "./explorerConversationScreenDisplay";

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

const VG = VIRTUAL_GUIDE_SHORT;

// The same four destinations as the design review's rail; none is connected yet.
export const CONNECTED_NAVIGATION: readonly ScreenNavigationItem[] = freeze([
  freeze({ id: "overview", label: "Overview", shortLabel: "Overview", noteKey: "overview", current: false } as const),
  freeze({ id: "conversations", label: "Conversations", shortLabel: "Conversations", noteKey: "conversations", current: true } as const),
  freeze({ id: "waypoints", label: "Waypoints", shortLabel: "Waypoints", noteKey: "waypoints", current: false } as const),
  freeze({ id: "settings", label: "Settings", shortLabel: "Settings", noteKey: "settings", current: false } as const),
]);

export const CONNECTED_CONVERSATION_SPACES: readonly ScreenConversationSpace[] = freeze([
  freeze({
    id: "virtualGuide",
    label: `With your ${VG}`,
    description: "Private to you",
    noteKey: "virtualGuideSpace",
    current: true,
  } as const),
  freeze({
    id: "guide",
    label: `With ${UNNAMED_GUIDE}`,
    description: "A separate space, still to come",
    noteKey: "guideSpace",
    current: false,
  } as const),
]);

// The screen receives no Guide relationship data, so the banner makes no
// claim about a Guide; it only says what the separate space will be.
export const CONNECTED_GUIDE_BANNER: ScreenGuideBanner = freeze({
  title: `Conversations with a ${SOLMIND_TERMS.guideRole}`,
  body: "They will have their own separate space, apart from this conversation.",
  button: `${SOLMIND_TERMS.guideRole} conversations`,
});

export const CONNECTED_SHELL: ScreenShellData = freeze({
  navigation: CONNECTED_NAVIGATION,
  conversationSpaces: CONNECTED_CONVERSATION_SPACES,
  profile: freeze({ name: "", role: SOLMIND_TERMS.explorerRole }),
  guideBanner: CONNECTED_GUIDE_BANNER,
  guideName: UNNAMED_GUIDE,
});

export const CONNECTED_GUIDE_NAME = UNNAMED_GUIDE;

export const CONNECTED_SPEAKER_LABELS: Readonly<Record<ScreenSpeaker, string>> = freeze({
  virtualGuide: SOLMIND_TERMS.virtualGuide,
  explorer: "You",
});

// The heading the screen focuses when it opens.
export const CONNECTED_TITLE = "Your conversation";

// The existing live sentence from the earlier connected screen.
export const CONNECTED_INTRO = `Explore with the ${SOLMIND_TERMS.virtualGuide}. Your conversation, Compass and Waypoints stay private; nothing is shared from this screen.`;

// "unknown" until an authenticated read succeeds (loading, denied, unavailable
// or needing a refresh): the header then says nothing about the conversation.
export type ConnectedConversationStatus = "unknown" | "notStarted" | "active" | "ended";

export function connectedHeaderLabel(status: ConnectedConversationStatus): string {
  switch (status) {
    case "unknown":
      return `Conversation ${MIDDLE_DOT} with your ${VG}`;
    case "ended":
      return `Ended conversation ${MIDDLE_DOT} with your ${VG}`;
    case "notStarted":
      return `New conversation ${MIDDLE_DOT} with your ${VG}`;
    case "active":
      return `Open conversation ${MIDDLE_DOT} with your ${VG}`;
  }
}

// The status line; none is shown while the status is unknown.
export function connectedStatusText(status: Exclude<ConnectedConversationStatus, "unknown">): string {
  switch (status) {
    case "notStarted":
      return "Not started yet. Private to you";
    case "active":
      return "Active and private";
    case "ended":
      return "Ended. Read-only and private";
  }
}

// The current Compass and Waypoint tools stay usable until the conversation
// forms the Compass and Waypoints itself (rebuild steps 4 and 5).
export const CURRENT_TOOLS_HEADING = "Your current Compass and Waypoint tools";
export const CURRENT_TOOLS_INTRO =
  "These are the tools you have used so far for your Compass and Waypoints. They stay here so your saved Compass and Waypoints remain usable while the new Compass & Waypoint card is built. Later, your Compass and Waypoints will form from the conversation instead.";
export const CURRENT_TOOLS_POINTER =
  "Until then, your saved Compass points and Waypoints are in your current tools, below the conversation.";

export const COMPOSER_LABEL = "Continue the conversation";
export const COMPOSER_PLACEHOLDER = "Share what comes to mind...";
