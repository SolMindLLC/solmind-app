// Fixed wording and display data for the connected /explorer/conversation
// screen: Paul's designed layout (the S01R2 look, the September 23 Explorer
// menu of his 2026-11-02 option A and the wireframe v6 structure first
// reviewed at /explorer/conversation-preview) showing the Explorer's real
// saved conversation.
//
// Nothing here is sample content and nothing here is private: the saved
// conversation itself arrives only through the authenticated feature route
// and is rendered by ExplorerConversation.tsx. Parts that are not connected
// yet show a blue "Not connected yet" build-note label and, when activated, the
// sentence from explorerConversationScreen.ts without its "Not yet
// implemented:" prefix; an area not built yet shows that sentence in a blue
// build-note box (Paul's build-note rule, 2026-11-03).
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
import { EXPLORER_CONVERSATION_SPACES, EXPLORER_MENU } from "./workspaceMenus";

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

const VG = VIRTUAL_GUIDE_SHORT;

// The shared Explorer menu, with Conversations as this screen's section.
export const CONNECTED_NAVIGATION: readonly ScreenNavigationItem[] = freeze(
  EXPLORER_MENU.map((entry) => freeze({ ...entry, current: entry.id === "conversations" })),
);

// The shared conversation spaces, with the Virtual Guide space as this screen.
export const CONNECTED_CONVERSATION_SPACES: readonly ScreenConversationSpace[] = freeze(
  EXPLORER_CONVERSATION_SPACES.map((space) => freeze({ ...space, current: space.id === "virtualGuide" })),
);

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

// The opening greeting (Paul's decision, decision queue 2026-11-05 19:13:28 CST,
// wish 1): a fixed welcome in a conversation that has no saved message yet, so
// the window is never blank. It is not a saved message, makes no AI call and
// is not sent to the Virtual Guide. Draft wording for Paul's wording read.
export const OPENING_GREETING_LABEL = `Welcome from the ${SOLMIND_TERMS.virtualGuide}`;
export const OPENING_GREETING_TEXT = `Welcome. I'm your ${SOLMIND_TERMS.virtualGuide}, here to help you reflect at your own pace. To begin, write whatever is on your mind and choose Send.`;

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
// The Compass & Waypoint card shows the saved Compass and Waypoints and points
// the needle (chat step slices S1 and S2); every other change still uses the
// current tools.
export const CURRENT_TOOLS_POINTER =
  "To add, arrange or reword Compass points, or to choose, clarify, reach or release a Waypoint, use your current tools below the conversation.";
// The sentence the current tools' violet "Planned for removal" tag shows on
// tap (Paul's build-note rule, decision queue 2026-11-03 18:03:39 CST; the
// tools go under his chat-step decision 8). A build note for reviewers.
export const CURRENT_TOOLS_REMOVAL_REASON =
  "These tools will be removed once the Compass & Waypoint card does everything they do.";

export const COMPOSER_LABEL = "Continue the conversation";
export const COMPOSER_PLACEHOLDER = "Share what comes to mind...";
