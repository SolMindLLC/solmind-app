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
import type { ExplorerConversationError } from "./explorerConversationContract";
import { UNNAMED_GUIDE, VIRTUAL_GUIDE_SHORT } from "./explorerConversationScreen";
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

// Paul's approved waiting sentence (screen wording part 5, 2026-11-12).
export const CONNECTED_WAITING_REPLY_TEXT = "Waiting for your Virtual Guide's reply...";

// The existing live sentence from the earlier connected screen. Since the compact header it is the
// first line inside the "Privacy and sharing" explanation (Paul's choice, 2026-11-16).
export const CONNECTED_INTRO = `Explore with the ${SOLMIND_TERMS.virtualGuide}. Your conversation, Compass and Waypoints stay private; nothing is shared from this screen.`;

// The opening greeting (Paul's decision, decision queue 2026-11-05 19:13:28 CST,
// wish 1): a fixed welcome in a conversation that has no saved message yet, so
// the window is never blank. It is not a saved message, makes no AI call and
// is not sent to the Virtual Guide. Draft wording for Paul's wording read.
export const OPENING_GREETING_LABEL = `Welcome from the ${SOLMIND_TERMS.virtualGuide}`;
export const OPENING_GREETING_TEXT = `Welcome. I'm your ${SOLMIND_TERMS.virtualGuide}, here to help you reflect at your own pace. To begin, write whatever is on your mind and choose Send.`;

// "unknown" until an authenticated read succeeds (loading, denied, unavailable
// or needing a refresh): the strip then says nothing about the conversation.
export type ConnectedConversationStatus = "unknown" | "notStarted" | "active" | "ended";

// The compact header strip (Paul's decisions, PRJ01-SPR002 decision record 2026-11-16 17:53:42 and
// 21:27:10 CST). The eleven approved entries, word for word (PROPOSAL_R3.md section 10, entries 1 to 11).
// Entry 1: the one button for everything about privacy.
export const PRIVACY_SHARING_BUTTON = "Privacy and sharing";
// Entry 2: beside the green light.
export const SAVED_STATUS_UP_TO_DATE = "Up to date at last check";
// Entry 3: beside the yellow light, always with its reason line (entry 6 or 7).
export const SAVED_STATUS_RELOAD_NEEDED = "Reload needed";
// Today's button name, kept in every state.
export const RELOAD_BUTTON = "Reload saved conversation";
// Entry 4: the spoken name of the "?" button.
export const RELOAD_HELP_BUTTON_NAME = "About Reload saved conversation";
// Entry 5: the explanation behind "?".
export const RELOAD_HELP_TEXT = "This screen checks your saved conversation only when it opens, when you make a change and when you reload it. To see changes made in another tab or on another device, choose Reload saved conversation.";
// Entries 6, 7 and 8: the reason line, always shown while its cause stands.
export const RELOAD_REASON_TEXT = freeze({
  changed: "To continue after your conversation has changed, choose Reload saved conversation.",
  pending: "To check whether your last message has a confirmed result, choose Reload saved conversation.",
  load: "To try loading your conversation again, choose Reload saved conversation.",
});
// Entry 9: the line at the true beginning of the conversation.
export const CONVERSATION_START_MARKER = "Start of your conversation";
// Entry 10: the two titled lines inside the "Privacy and sharing" explanation.
export const PRIVACY_CAN_SEE_TITLE = `What the ${VIRTUAL_GUIDE_SHORT} can see`;
export const PRIVACY_SHARE_TITLE = "Share whole conversation";
// Entry 11: the busy sentence while a Reload runs with a conversation on screen.
export const RELOAD_CHECKING_TEXT = "Checking your saved conversation...";

export type ConnectedReloadReason = keyof typeof RELOAD_REASON_TEXT;

export type ConnectedSavedStatusInput = Readonly<{
  // The error code the conversation logic holds, also while the last change is uncertain.
  errorCode: ExplorerConversationError | null;
  uncertain: boolean;
  busy: boolean;
  awaitingReply: boolean;
  // A saved conversation is on screen.
  hasState: boolean;
  // The saved conversation says a result is pending.
  pendingTurn: boolean;
  // The last accepted answer confirmed the saved conversation (never true by omission).
  lastCheckConfirmed: boolean;
  // The busy sentence the logic handed over, or "".
  busySentence: string;
}>;

export type ConnectedSavedStatus = Readonly<{
  // The line of the order of precedence that matched (1 to 10).
  line: number;
  light: "green" | "yellow" | null;
  // The light's words, or the busy sentence, or "".
  words: string;
  reloadShown: boolean;
  reloadEnabled: boolean;
  helpButtonShown: boolean;
  // The reason line that is always shown, or null when the help text sits behind "?".
  reasonLine: ConnectedReloadReason | null;
}>;

type SavedStatusCause = Readonly<{ line: number; light: "green" | "yellow" | null; words: string;
  helpButtonShown: boolean; reasonLine: ConnectedReloadReason | null }>;

// Lines 6 to 10: what the saved conversation's own condition gives when nothing is in flight.
function savedStatusCause(input: ConnectedSavedStatusInput): SavedStatusCause {
  if (input.errorCode === "refresh_required") {
    return { line: 6, light: "yellow", words: SAVED_STATUS_RELOAD_NEEDED, helpButtonShown: false, reasonLine: "changed" };
  }
  if (input.pendingTurn) {
    return { line: 7, light: "yellow", words: SAVED_STATUS_RELOAD_NEEDED, helpButtonShown: false, reasonLine: "pending" };
  }
  if (input.errorCode !== null) {
    return { line: 8, light: null, words: "", helpButtonShown: input.hasState, reasonLine: input.hasState ? null : "load" };
  }
  // Green needs the positive fact and a saved conversation on screen; blank text never means green.
  if (input.hasState && input.lastCheckConfirmed) {
    return { line: 9, light: "green", words: SAVED_STATUS_UP_TO_DATE, helpButtonShown: true, reasonLine: null };
  }
  return { line: 10, light: null, words: "", helpButtonShown: true, reasonLine: null };
}

// The order of precedence for the strip (PROPOSAL_R3.md section 3): the first line that matches wins.
// It makes no request and reads nothing but its input.
export function connectedSavedStatus(input: ConnectedSavedStatusInput): ConnectedSavedStatus {
  if (input.errorCode === "denied") {
    return freeze({ line: 1, light: null, words: "", reloadShown: false, reloadEnabled: false, helpButtonShown: false, reasonLine: null });
  }
  if (input.uncertain) {
    return freeze({ line: 2, light: null, words: "", reloadShown: false, reloadEnabled: false, helpButtonShown: false, reasonLine: null });
  }
  const cause = savedStatusCause(input);
  // Lines 3 and 5 hide only the light and its words; "?" and the reason line follow the cause underneath.
  if (input.busy && !input.hasState) {
    return freeze({ line: 3, light: null, words: input.busySentence, reloadShown: true, reloadEnabled: false,
      helpButtonShown: cause.helpButtonShown, reasonLine: cause.reasonLine });
  }
  if (input.awaitingReply) {
    return freeze({ line: 4, light: null, words: "", reloadShown: true, reloadEnabled: false, helpButtonShown: true, reasonLine: null });
  }
  if (input.busy) {
    return freeze({ line: 5, light: null, words: input.busySentence, reloadShown: true, reloadEnabled: false,
      helpButtonShown: cause.helpButtonShown, reasonLine: cause.reasonLine });
  }
  return freeze({ ...cause, reloadShown: true, reloadEnabled: true });
}

// The strip's two explanations: only one is open at a time. Choosing the open one closes it and
// shows none; choosing the other one opens it and closes the first.
export type ConnectedStripExplanation = "privacy" | "help" | null;

export function nextStripExplanation(open: ConnectedStripExplanation, chosen: "privacy" | "help"): ConnectedStripExplanation {
  return open === chosen ? null : chosen;
}

// Where keyboard focus goes when the control that held it leaves the screen (focus rule 2), in
// this order: Reload saved conversation when enabled, Retry the same request, Sign in, the title.
// A title that moved between the strip and the chat panel keeps focus on the title.
export type ConnectedStripFocusTarget = "reload" | "retry" | "signIn" | "title";

export function connectedStripFocusTarget(input: Readonly<{ lost: "title" | "control"; reloadEnabled: boolean;
  retryShown: boolean; signInShown: boolean }>): ConnectedStripFocusTarget {
  if (input.lost === "title") return "title";
  return input.reloadEnabled ? "reload" : input.retryShown ? "retry" : input.signInShown ? "signIn" : "title";
}

// Focus that waited on the title while a request ran (for example after Retry, which leaves the
// screen as soon as it is chosen): when the answer arrives it moves on to the control the Explorer
// now needs, or stays on the title when nothing is needed.
export function connectedWaitingFocusTarget(input: Readonly<{ retryShown: boolean; signInShown: boolean;
  reloadEnabled: boolean; reasonLineShown: boolean }>): Exclude<ConnectedStripFocusTarget, "title"> | null {
  if (input.retryShown) return "retry";
  if (input.signInShown) return "signIn";
  return input.reloadEnabled && input.reasonLineShown ? "reload" : null;
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

// The transcript sized to the window (compact header step B; Paul's choice "A + B", decision record
// 2026-11-16 17:53:42 and 21:27:10 CST). All figures are CSS pixels. "gap" is the space kept under the
// message box area; it equals the 16 px scroll margin of the page-open markers, so a transcript that was
// sized to fit needs no page move when the conversation opens.
export const TRANSCRIPT_HEIGHT = freeze({ smallest: 224, largest: 832, gap: 16 });

// height = Math.min(832, Math.max(224, availableHeight)), with
// availableHeight = windowHeight - gap - top - below, where "top" is the distance from the top of the page
// (not of the window) to the top of the transcript and "below" is the distance from the bottom of the
// transcript to the bottom of what must stay in view with it (the message box area, or the read-only
// explanation of an ended conversation). It does not depend on the transcript's present height or on how far
// the page is scrolled.
export function connectedTranscriptHeight(input: Readonly<{ windowHeight: number; top: number; below: number }>): number {
  const available = input.windowHeight - TRANSCRIPT_HEIGHT.gap - input.top - input.below;
  if (!Number.isFinite(available)) return TRANSCRIPT_HEIGHT.smallest;
  return Math.min(TRANSCRIPT_HEIGHT.largest, Math.max(TRANSCRIPT_HEIGHT.smallest, Math.round(available)));
}

// The transcript scrolls itself to its newest end only with saved messages or while a Send is awaited; a
// conversation with no saved message and nothing being sent stays at position zero, so its start marker and
// welcome are in view.
export function connectedTranscriptScrollsToEnd(messageCount: number, awaitingReply: boolean): boolean {
  return messageCount > 0 || awaitingReply;
}

// The once-only page move on open is skipped when its target (the end of the conversation area, with its
// scroll margin under it) is already inside the window.
export function connectedOpenTargetInView(input: Readonly<{ top: number; bottom: number; windowHeight: number }>): boolean {
  return input.top >= 0 && input.bottom + TRANSCRIPT_HEIGHT.gap <= input.windowHeight + 1;
}

export const COMPOSER_LABEL = "Continue the conversation";
export const COMPOSER_KEY_HINT = "To send your message, press Enter. To start a new line, press Shift+Enter or Alt+Enter.";
export const COMPOSER_PLACEHOLDER = "Share what comes to mind...";
