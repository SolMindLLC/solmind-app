// Fixed wording for the interim /explorer/conversation-preview design review.
//
// Nothing here changes state or reaches a provider, database, Guide or network.
// Each "Not yet implemented" sentence says what a control will do once the
// connected screen exists. Every sentence is an AI draft that Paul has not yet
// approved. Sample content for the screen lives in
// explorerConversationScreenSample.ts.

import { SOLMIND_TERMS } from "./terms";

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

export const NOT_YET_IMPLEMENTED_PREFIX = "Not yet implemented:";
export const LAYOUT_ONLY_LABEL = "Layout only: works in this preview";
export const SAMPLE_TAG_LABEL = "Sample";
export const SPEAKER_STYLE_SWITCH_LABEL = "Speaker labels:";

// The existing design uses a middle dot between header phrases.
export const MIDDLE_DOT = String.fromCharCode(0xb7);

// "Virtual Guide" without the product name, derived from the canonical term.
export const VIRTUAL_GUIDE_SHORT = SOLMIND_TERMS.virtualGuide.slice(
  SOLMIND_TERMS.productName.length + 1,
);

const VG = VIRTUAL_GUIDE_SHORT;
const GUIDE = SOLMIND_TERMS.guideRole;

function note(text: string): string {
  return `${NOT_YET_IMPLEMENTED_PREFIX} ${text}`;
}

export const NOT_YET_IMPLEMENTED = freeze({
  // Navigation
  overview: note("Overview will show where your journey stands, so you can pick up easily."),
  conversations: note("This list will show your conversations, so you can continue one or start fresh."),
  virtualGuideSpace: note(`This will open the space for your conversations with your ${VG}.`),
  newConversation: note("This will start a new conversation, without choosing a Waypoint first."),
  waypoints: note("Waypoints will gather your Waypoints in one place, so you can revisit them."),
  settings: note(`Settings will let you choose your ${VG}'s name and other preferences.`),
  notifications: note("Notifications will quietly let you know when something is waiting for you."),
  profile: note("Your profile will show your details and sign-in choices."),
  breadcrumb: note("This will take you back to your list of conversations."),
  // Header
  rename: note(`You will be able to name your ${VG}, so it feels like your own.`),
  virtualGuideCanSee: note(
    `This will explain exactly what your ${VG} can see, so you know what stays private.`,
  ),
  // Opening choices
  choiceGroup: note(
    `Your ${VG} will offer calm ways to begin, or you can simply say what's on your mind.`,
  ),
  choice: note("Choosing one will place it in your message, and you still press Send."),
  somethingElse: note("This will clear the suggestions so you can begin in your own words."),
  followUpChoices: note(
    "After something is captured, new directions may appear, without forcing a new topic.",
  ),
  earlierCompass: note(
    "A new conversation will be able to start from an earlier Compass, or fresh in Discovery.",
  ),
  // Messages
  checkUnderstanding: note(
    `Your ${VG} will check its understanding here. Only your answer captures anything.`,
  ),
  notQuiteRight: note("You will be able to say it misunderstood, so it can correct its understanding."),
  reopen: note("You will be able to reopen a captured part by talking it through again."),
  slowDown: note(`You will be able to ask your ${VG} to slow down at any time.`),
  latestChange: note("This line will tell you what just changed on your Compass or Waypoint."),
  // Composer
  message: note("You will be able to type your message here, and nothing is saved until you press Send."),
  send: note(`Send will save your message, and your ${VG} will reply.`),
  pause: note(
    "Pause will keep this conversation, your Compass and your Waypoint just as they are. Resume will bring you back to exactly where you paused.",
  ),
  finishReview: note(
    "Finish & Review will show where your Compass went and any Waypoint progress. Reviewing does not stop existing live sharing or change your sharing choices. The review will offer the next step that fits this Waypoint, with a way back that changes nothing.",
  ),
  end: note("Ending will take you home and keep a read-only record of this conversation."),
  continueFromThis: note(
    "This will start a new conversation that carries on from this one. This record stays.",
  ),
  // Compass
  compass: note("Your Compass will fill in from what you talk about, and you confirm what matters."),
  formingPoint: note("New points will show as Forming until you confirm them at a natural pause."),
  otherPaths: note("Directions beyond the first eight will be kept here, so nothing is lost."),
  compactView: note("When this panel is closed, a small view will show your most recent directions."),
  needle: note(
    "The needle will follow what you are talking about right now. It never changes your Priority.",
  ),
  attention: note("You will be able to point the needle yourself. This never changes your Priority."),
  prioritySuggestion: note(
    `If something seems more important, your ${VG} will ask before your Priority changes.`,
  ),
  // OQ-4 is still open, so the control is marked as proposed.
  makePriority: note(
    "Proposed direct Priority control, pending design approval. Priority changes only when you confirm.",
  ),
  // Waypoint
  waypointCard: note(
    "When a possible Waypoint takes shape, it will appear here. It becomes yours only when you choose it.",
  ),
  keyInsight: note(
    "Realizations you confirm will be kept here as Key Insights, because they are progress too.",
  ),
  exploreNext: note(
    "This will bring this direction into your conversation without creating a new Waypoint.",
  ),
  quote: note("Selecting a quote will take you to that moment in your conversation."),
  reachedSuggestion: note(
    `When you describe arriving, your ${VG} will ask whether this is Reached. Only you decide.`,
  ),
  confirmReached: note("You will confirm Reached yourself, after looking at what shows you arrived."),
  release: note("Release will set this Waypoint aside. It stays in your private history."),
  revisit: note("Revisit will start a fresh round without erasing what you reached."),
  guideSuggestions: note(`Suggestions from your ${GUIDE} will appear here, clearly marked as theirs.`),
  // Sharing
  shareLine: note(
    "When you share this conversation, formed Waypoints will be shared live with it by default.",
  ),
  stopSharing: note("You will be able to stop sharing at any time."),
});

// "<name>, your Guide": the Guide's name with their role.
export function guideLabel(guideName: string): string {
  return `${guideName}, your ${GUIDE}`;
}

// The notes that name the Guide. Like aiDisclosure, they take the name from
// the display props, so they follow whatever Guide name is shown.
export function guideNotes(guideName: string) {
  return freeze({
    guideSpace: note(`This will open your separate conversations with ${guideLabel(guideName)}.`),
    shareConversation: note(
      `You will be able to share this whole conversation live with ${guideName}, until you stop.`,
    ),
    guideInput: note(`${guideName}'s input on a Waypoint you shared will appear here, marked as theirs.`),
    shareForming: note(`You will be able to share a forming Waypoint with ${guideName} to ask for input.`),
    shareReason: note(`You may add a short reason for ${guideName} when you share.`),
  });
}

export type FixedNoteKey = keyof typeof NOT_YET_IMPLEMENTED;
export type GuideNoteKey = keyof ReturnType<typeof guideNotes>;
export type NotYetImplementedKey = FixedNoteKey | GuideNoteKey;

// Every note for one Guide name: the fixed notes and those naming the Guide.
export function notYetImplementedNotes(guideName: string): Readonly<Record<NotYetImplementedKey, string>> {
  return freeze({ ...NOT_YET_IMPLEMENTED, ...guideNotes(guideName) });
}

// The note for one key. A note that names the Guide needs the Guide name.
export function notYetImplementedText(key: NotYetImplementedKey, guideName?: string): string {
  if (Object.hasOwn(NOT_YET_IMPLEMENTED, key)) return NOT_YET_IMPLEMENTED[key as FixedNoteKey];
  if (guideName === undefined) throw new Error(`guide_name_required:${key}`);
  return guideNotes(guideName)[key as GuideNoteKey];
}

// Controls that change only what this screen shows. They work in the preview,
// carry the LAYOUT_ONLY_LABEL tag and have no "Not yet implemented" note.
export const LAYOUT_ONLY_CONTROLS = freeze([
  freeze({ key: "skipLink", label: "Skip to the conversation" }),
  freeze({ key: "conversationSpaces", label: "Conversation spaces (narrow screens)" }),
  freeze({ key: "panelToggle", label: "Show or hide Compass & Waypoint" }),
  freeze({ key: "drawerOpen", label: "Open Compass & Waypoint (narrow screens)" }),
  freeze({ key: "drawerClose", label: "Close Compass & Waypoint" }),
  freeze({ key: "compassView", label: "Compact view and Full view" }),
  freeze({ key: "quoteList", label: "Supporting quotes list" }),
  freeze({ key: "escape", label: "Escape closes the Compass & Waypoint drawer" }),
  freeze({ key: "speakerStyle", label: "Speaker labels: New / Original" }),
]);

export const PREVIEW_BAND_TEXT = `Interim design review. Nothing here is connected: no AI, no ${GUIDE}, and nothing is saved or shared. Messages are written samples. Each 'Not yet implemented' note says what that part will do.`;

// OQ-18 recommendation, not yet contradicted by Paul. The name comes from the
// display props, so the disclosure follows whatever Virtual Guide name is shown.
export function aiDisclosure(virtualGuideName: string): string {
  return `${virtualGuideName} is an AI companion, not your ${GUIDE}, a therapist or a crisis service.`;
}

// The approved live sentence from the connected conversation screen.
export const CONVERSATION_FOOTER = `The ${SOLMIND_TERMS.virtualGuide} supports reflection. It is not a therapist or crisis service.`;

export const PREVIEW_PAGE_TITLE = "Explorer conversation screen design review - SolMind MVP0";
export const PREVIEW_PAGE_DESCRIPTION = `An interim design review of the ${SOLMIND_TERMS.explorerRole} conversation screen. Nothing is connected: no AI, no ${GUIDE}, and nothing is saved or shared.`;
