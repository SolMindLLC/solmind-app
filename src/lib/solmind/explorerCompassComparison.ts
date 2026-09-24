// Pure, deterministic state for the /explorer/compass-comparison prototype.
//
// Everything here is fixed, local, and in-memory. The scenario turns, the
// SolMind Virtual Guide questions, and every reply come from a fixed script
// that never reads or interprets the Explorer's words. Current attention moves
// freely; the Priority changes only after explicit Explorer confirmation; and
// Waypoint details change only through answers the Explorer gives inside the
// conversation. Sharing and every destination outside this screen are
// explained honestly and never simulated. The React component owns one state
// object built here; it adds only browser focus and viewport detection.

import { SOLMIND_TERMS } from "./terms";

// ---------------------------------------------------------------------------
// Fixed identity, copy, and element identifiers
// ---------------------------------------------------------------------------

export const SOLMIND_LOGO_SRC = "/solmind-dark-logo.png";
export const NOT_CONNECTED_LABEL = "Not connected yet";
export const EXPLORER_DISPLAY_NAME = "Avery";
export const ASSIGNED_GUIDE_NAME = "Jordan";
export const ASSIGNED_GUIDE_LABEL = `${ASSIGNED_GUIDE_NAME}, your ${SOLMIND_TERMS.guideRole}`;
export const DEFAULT_VIRTUAL_GUIDE_NAME = "Mary";
export const VIRTUAL_GUIDE_NAME_MAX_LENGTH = 40;
export const COMPOSER_MESSAGE_MAX_LENGTH = 600;
export const JOURNEY_TITLE = "Today's Reflection Journey";
export const JOURNEY_KIND_LABEL = "Open reflection";
export const JOURNEY_STARTING_QUESTION = "What feels most important today?";
export const POTENTIAL_ARRIVAL = "I can name what I need before the conversation";
export const POSSIBLE_NEXT_WAYPOINT = "Decide when to have the conversation";
export const EXPLORE_NEXT_DIRECTION_DRAFT =
  "I'd like to explore when to have the conversation.";
export const COMPACT_RECENT_ORIENTATION_LIMIT = 3;
export const MIDDLE_DOT = String.fromCharCode(0xb7);

export const JOURNEY_HEADING_ID = "journey-heading";
export const RESET_FOCUS_TARGET_ID = JOURNEY_HEADING_ID;

export function turnElementId(turnId: string): string {
  return `conversation-${turnId}`;
}

export function quotationElementId(quotationId: QuotationId): string {
  return `quotation-${quotationId}`;
}

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SupportLayout = "wide" | "narrow";
export type WorkspaceView = "journey" | "conversations";
export type ConversationKind = "retainedScenario" | "openEnded";
export type JourneyPhase = "active" | "paused" | "reviewing" | "finished";
export type JourneyOutcome = "noWaypoint" | "keptForming" | "reached";

export type PrimaryDestinationId =
  | "overview"
  | "conversations"
  | "waypoints"
  | "settings";

export type ConversationSpaceId = "virtualGuide" | "guide";

export type NotConnectedDestinationId =
  | "overview"
  | "waypoints"
  | "settings"
  | "guideConversations"
  | "earlierConversation"
  | "notifications"
  | "profile";

export type ConnectionState = "local" | "notConnected";

export type PrimaryNavigationItem = Readonly<{
  id: PrimaryDestinationId;
  label: string;
  connection: ConnectionState;
}>;

export type ConversationSpace = Readonly<{
  id: ConversationSpaceId;
  label: string;
  description: string;
  connection: ConnectionState;
}>;

export type PrototypeExplanation = Readonly<{
  title: string;
  statements: readonly Readonly<{ id: string; text: string }>[];
}>;

export type NotConnectedCopy = Readonly<{
  title: string;
  statements: readonly string[];
}>;

export type CompassPathId =
  | "understand-need"
  | "timing"
  | "avoiding-conflict"
  | "afterward";

export type CompassZone = "priority" | "detourLeft" | "detourRight" | "excursion";
export type CompassView = "full" | "compact";

export type CompassPath = Readonly<{
  id: CompassPathId;
  label: string;
  labelLines: readonly [string, string];
  homeZone: CompassZone;
}>;

export type CompassLayoutItem = Readonly<{
  path: CompassPath;
  zone: CompassZone;
  zoneLabel: string;
  isPriority: boolean;
  isAttention: boolean;
  isPendingPriority: boolean;
}>;

export type WaypointStatus = "none" | "forming" | "reached";
export type WaypointDetailId =
  | "insight-clarity"
  | "evidence-describe-need"
  | "evidence-name-need";
export type WaypointDetailKind = "keyInsight" | "arrivalEvidence";
export type WaypointDetailState = "forming" | "captured";

export type WaypointDetail = Readonly<{
  id: WaypointDetailId;
  kind: WaypointDetailKind;
  text: string;
}>;

export type QuotationId =
  | "quote-clarity-guide"
  | "quote-clarity-explorer"
  | "quote-describe-current"
  | "quote-describe-earlier"
  | "quote-name-need";

export type QuotationStatus = "current" | "superseded";

export type SupportingQuotation = Readonly<{
  id: QuotationId;
  detailId: WaypointDetailId;
  turnId: string;
  text: string;
  status: QuotationStatus;
}>;

export type OpeningTopicId =
  | "difficult-conversation"
  | "others-understand"
  | "relationship"
  | "decision"
  | "feeling-lately";

export type FollowUpChoiceId =
  | "follow-up-stay"
  | "follow-up-timing"
  | "follow-up-afterward";

export type ConversationChoiceId =
  | OpeningTopicId
  | "opening-something-else"
  | FollowUpChoiceId
  | "follow-up-something-else";

export type ConversationChoiceGroup =
  | "continue"
  | "new"
  | "followUp"
  | "somethingElse";

export type ConversationChoice = Readonly<{
  id: ConversationChoiceId;
  label: string;
  tag: string | null;
  group: ConversationChoiceGroup;
  topic: string | null;
}>;

export type TurnSpeaker = "explorer" | "virtualGuide";
export type TurnOrigin =
  | "scenario"
  | "explorerMessage"
  | "scriptedReply"
  | "verificationPrompt"
  | "verificationReply";

export type VerificationMode = "capture" | "reopen";
export type VerificationAnswer = "yes" | "no";

export type TurnVerification = Readonly<{
  detailId: WaypointDetailId;
  mode: VerificationMode;
  answer: VerificationAnswer | null;
}>;

export type ConversationTurn = Readonly<{
  id: string;
  speaker: TurnSpeaker;
  origin: TurnOrigin;
  body: string;
  offersOpeningChoices: boolean;
  offersFollowUpChoices: boolean;
  verification: TurnVerification | null;
}>;

export type ComposerPrompt = "default" | "somethingElse";
export type ComposerError = "blank" | "tooLong";

export type ComposerValidation =
  | Readonly<{ ok: true; text: string }>
  | Readonly<{ ok: false; reason: ComposerError }>;

export type PrototypeDialog =
  | Readonly<{ kind: "conversationSharing" }>
  | Readonly<{ kind: "waypointSharing" }>
  | Readonly<{ kind: "quotationSharing"; quotationId: QuotationId }>
  | Readonly<{ kind: "notConnected"; destination: NotConnectedDestinationId }>
  | Readonly<{ kind: "newConversationConfirmation" }>
  | Readonly<{ kind: "resetConfirmation" }>
  | Readonly<{ kind: "aboutPrototype" }>;

export type SourceHighlight = Readonly<{
  turnId: string;
  quotationId: QuotationId;
}>;

export type SupportPanelState = Readonly<{
  wideVisible: boolean;
  narrowOpen: boolean;
}>;

export type ExplorerConversationState = Readonly<{
  conversationKind: ConversationKind;
  view: WorkspaceView;
  phase: JourneyPhase;
  outcome: JourneyOutcome | null;
  conversationVisibility: "private";
  waypointVisibility: "private";
  turns: readonly ConversationTurn[];
  selectedChoiceId: ConversationChoiceId | null;
  composerDraft: string;
  composerPrompt: ComposerPrompt;
  composerError: ComposerError | null;
  virtualGuideName: string;
  renameDraft: string | null;
  attentionPathId: CompassPathId;
  priorityPathId: CompassPathId;
  priorityConfirmed: boolean;
  pendingPriorityPathId: CompassPathId | null;
  orientationHistory: readonly CompassPathId[];
  compassView: CompassView;
  waypointStatus: WaypointStatus;
  detailStates: Readonly<Record<WaypointDetailId, WaypointDetailState>>;
  openQuotationDetailIds: readonly WaypointDetailId[];
  sourceHighlight: SourceHighlight | null;
  supportPanel: SupportPanelState;
  navigationMenuOpen: boolean;
  dialog: PrototypeDialog | null;
  activity: string;
}>;

// ---------------------------------------------------------------------------
// Navigation and honest incomplete-destination copy
// ---------------------------------------------------------------------------

export const PRIMARY_NAVIGATION: readonly PrimaryNavigationItem[] = freeze([
  freeze<PrimaryNavigationItem>({
    id: "overview",
    label: "Overview",
    connection: "notConnected",
  }),
  freeze<PrimaryNavigationItem>({
    id: "conversations",
    label: "Conversations",
    connection: "local",
  }),
  freeze<PrimaryNavigationItem>({
    id: "waypoints",
    label: "Waypoints",
    connection: "notConnected",
  }),
  freeze<PrimaryNavigationItem>({
    id: "settings",
    label: "Settings",
    connection: "notConnected",
  }),
]);

export const ACTIVE_PRIMARY_DESTINATION: PrimaryDestinationId = "conversations";

export const CONVERSATION_SPACES: readonly ConversationSpace[] = freeze([
  freeze<ConversationSpace>({
    id: "virtualGuide",
    label: "With your Virtual Guide",
    description: "Waypoint conversations, private to you",
    connection: "local",
  }),
  freeze<ConversationSpace>({
    id: "guide",
    label: `With ${ASSIGNED_GUIDE_LABEL}`,
    description: "Direct conversations, a separate space",
    connection: "notConnected",
  }),
]);

// The Guide conversation space, the Guide continuity banner, and the Guide
// section of the Conversations list all open this one destination.
export const GUIDE_CONVERSATIONS_DESTINATION: NotConnectedDestinationId =
  "guideConversations";

export const NOT_CONNECTED_DESTINATIONS: Readonly<
  Record<NotConnectedDestinationId, NotConnectedCopy>
> = freeze({
  overview: freeze<NotConnectedCopy>({
    title: `Overview: ${NOT_CONNECTED_LABEL}`,
    statements: freeze([
      `The ${SOLMIND_TERMS.explorerRole} Overview is not connected in this prototype.`,
      "You are still in Conversations, and nothing on this screen changed.",
    ]),
  }),
  waypoints: freeze<NotConnectedCopy>({
    title: `Waypoints: ${NOT_CONNECTED_LABEL}`,
    statements: freeze([
      "The Waypoints destination is not connected in this prototype.",
      "Your Forming Waypoint stays in the Compass & Waypoint panel beside this conversation.",
    ]),
  }),
  settings: freeze<NotConnectedCopy>({
    title: `Settings: ${NOT_CONNECTED_LABEL}`,
    statements: freeze([
      "Settings are not connected in this prototype.",
      "You can rename your Virtual Guide on this screen. The name lasts only until you refresh or reset.",
    ]),
  }),
  guideConversations: freeze<NotConnectedCopy>({
    title: `Conversations with ${ASSIGNED_GUIDE_NAME}: ${NOT_CONNECTED_LABEL}`,
    statements: freeze([
      `Direct conversations with ${ASSIGNED_GUIDE_LABEL}, are a separate space from Waypoint conversations with your Virtual Guide. That space is not connected in this prototype.`,
      `${ASSIGNED_GUIDE_NAME} is not part of this conversation and is not reading it. Nothing was sent to ${ASSIGNED_GUIDE_NAME}.`,
    ]),
  }),
  earlierConversation: freeze<NotConnectedCopy>({
    title: `Earlier conversations: ${NOT_CONNECTED_LABEL}`,
    statements: freeze([
      "Earlier conversations are not connected in this prototype.",
      '"What I need others to understand" is listed only to show where an earlier topic would appear.',
    ]),
  }),
  notifications: freeze<NotConnectedCopy>({
    title: `Notifications: ${NOT_CONNECTED_LABEL}`,
    statements: freeze([
      "Notifications are not connected in this prototype.",
      "Nothing was sent to you or from you.",
    ]),
  }),
  profile: freeze<NotConnectedCopy>({
    title: `Your profile: ${NOT_CONNECTED_LABEL}`,
    statements: freeze([
      `Your ${SOLMIND_TERMS.explorerRole} profile is not connected in this prototype.`,
      `${EXPLORER_DISPLAY_NAME} is a fixed sample name used only on this screen.`,
    ]),
  }),
});

// Conversation sharing is all-or-none continuing access to one complete live
// conversation. The service is not connected here, so this is explanation only.
export const CONVERSATION_SHARING_EXPLANATION: PrototypeExplanation = freeze({
  title: `Conversation sharing: ${NOT_CONNECTED_LABEL}`,
  statements: freeze([
    freeze({
      id: "notConnected",
      text: "Conversation sharing is not connected in this prototype. This conversation is still private, and nothing was saved or shared.",
    }),
    freeze({
      id: "wholeConversation",
      text: `In SolMind, you would deliberately give ${ASSIGNED_GUIDE_LABEL}, continuing access to this whole conversation. It is all or none: there are no selected messages, ranges, or copies.`,
    }),
    freeze({
      id: "existingAndFutureEntries",
      text: `While access is active, ${ASSIGNED_GUIDE_NAME} could see everything already in this conversation and every new entry added later.`,
    }),
    freeze({
      id: "immutableHistory",
      text: "Past entries cannot be edited or selectively removed.",
    }),
    freeze({
      id: "continuesUntilEnded",
      text: `Access would continue until you revoke it or your relationship with ${ASSIGNED_GUIDE_NAME} ends.`,
    }),
    freeze({
      id: "noAutomaticReturn",
      text: "If that Guide relationship later resumes, or you begin with a new Guide, access does not return on its own. You would need to choose to share the whole conversation again.",
    }),
    freeze({
      id: "revocationLimits",
      text: `Revoking stops ${ASSIGNED_GUIDE_NAME}'s continuing access, but it cannot erase what ${ASSIGNED_GUIDE_NAME} already saw.`,
    }),
    freeze({
      id: "separateFromWaypoints",
      text: "Sharing a conversation never shares a Waypoint as a separate item. Waypoint sharing and quotation sharing each require their own explicit choice.",
    }),
    freeze({
      id: "quotationsInsideConversation",
      text: `Because ${ASSIGNED_GUIDE_NAME} could see the whole continuing conversation, they would see quotations wherever those words occur in the conversation. That does not separately share, label, or link any quotation as Waypoint evidence.`,
    }),
  ]),
});

export const NEW_CONVERSATION_CONFIRMATION_COPY: PrototypeExplanation = freeze({
  title: "Start a new conversation?",
  statements: freeze([
    freeze({
      id: "new-conversation-single-state",
      text: "This fixed prototype keeps one working conversation in memory. Starting a new one replaces the current on-screen state; it does not delete a conversation from a real account.",
    }),
    freeze({
      id: "new-conversation-reopen-sample",
      text: "You can reset or refresh the prototype to reopen its fixed Forming-Waypoint example. The connected product will preserve every conversation in the list.",
    }),
  ]),
});

export const WAYPOINT_SHARING_EXPLANATION: PrototypeExplanation = freeze({
  title: `Waypoint sharing: ${NOT_CONNECTED_LABEL}`,
  statements: freeze([
    freeze({
      id: "nothingSavedOrShared",
      text: "Waypoint sharing is not connected in this prototype. No Waypoint was saved or shared.",
    }),
    freeze({
      id: "explicitAction",
      text: `In SolMind, sharing this Waypoint with ${ASSIGNED_GUIDE_NAME} would require a separate, explicit action. The exact review would show the Waypoint content, including any Key Insights, before you confirm it.`,
    }),
    freeze({
      id: "separateFromConversation",
      text: "Waypoint sharing, supporting-quotation sharing, and whole-conversation sharing are independent choices. Sharing any one never selects either of the others.",
    }),
    freeze({
      id: "quotationChoice",
      text: "Supporting quotations stay private unless you explicitly select the exact quotations to add. Selecting a quotation does not grant access to the surrounding private conversation.",
    }),
    freeze({
      id: "prototypeOnly",
      text: "This Reached Waypoint exists only on this screen. Refreshing the page or resetting the prototype clears it.",
    }),
  ]),
});

export function getQuotationSharingExplanation(
  quotationId: QuotationId,
): PrototypeExplanation {
  const quotation = getSupportingQuotation(quotationId);
  const quotedText = quotation?.text ?? "Quotation unavailable";

  return freeze({
    title: `Quotation sharing: ${NOT_CONNECTED_LABEL}`,
    statements: freeze([
      freeze({
        id: "nothingSavedOrShared",
        text: "Quotation sharing is not connected in this prototype. No quotation was saved or shared.",
      }),
      freeze({
        id: "exactQuotationPreview",
        text: `The exact quotation you selected is: \u201c${quotedText}\u201d`,
      }),
      freeze({
        id: "explicitAction",
        text: `In SolMind, sharing this exact quotation with ${ASSIGNED_GUIDE_NAME} would require a separate, explicit confirmation after you review these words.`,
      }),
      freeze({
        id: "independentChoice",
        text: "Quotation sharing, Waypoint sharing, and whole-conversation sharing are independent choices. Sharing this quotation would not share its surrounding conversation or the Waypoint it supports.",
      }),
      freeze({
        id: "prototypeOnly",
        text: "This quotation exists only in the fixed local prototype. Refreshing the page or resetting the prototype clears this screen.",
      }),
    ]),
  });
}

export const RESET_CONFIRMATION_COPY: NotConnectedCopy = freeze({
  title: "Reset this prototype?",
  statements: freeze([
    "Reset returns this screen to its exact starting point.",
    "Your messages, answers, Compass changes, Waypoint confirmations, and Virtual Guide name on this screen will be cleared. Nothing was saved anywhere, so nothing else is removed.",
  ]),
});

export const PROTOTYPE_DISCLOSURE: NotConnectedCopy = freeze({
  title: "About this prototype",
  statements: freeze([
    "This is an early fixed-script prototype for design review. Virtual Guide turns and replies come from a fixed local script held in this page's memory; they do not read or interpret what you type.",
    `No AI model and no human Guide is responding. ${ASSIGNED_GUIDE_NAME} is not part of this conversation.`,
    "Nothing is saved, shared, sent, or stored. Refreshing the page or resetting the prototype clears everything on this screen.",
    "SolMind is not a therapist or a crisis service.",
  ]),
});

export const PROTOTYPE_FOOTNOTE =
  "Early fixed-script prototype. Replies are scripted, not live. Not a therapist or crisis service. Refresh clears this screen.";

// ---------------------------------------------------------------------------
// Virtual Guide naming
// ---------------------------------------------------------------------------

export function normalizeVirtualGuideName(rawName: string): string {
  return rawName
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, VIRTUAL_GUIDE_NAME_MAX_LENGTH)
    .trim();
}

export function getVirtualGuidePrimaryLabel(name: string): string {
  const cleanName = normalizeVirtualGuideName(name);

  return cleanName
    ? `${cleanName} (${SOLMIND_TERMS.virtualGuide})`
    : SOLMIND_TERMS.virtualGuide;
}

export function getVirtualGuideTurnLabel(name: string): string {
  const cleanName = normalizeVirtualGuideName(name);

  return cleanName ? `${cleanName} (Virtual Guide)` : SOLMIND_TERMS.virtualGuide;
}

export function getSpeakerLabel(
  turn: ConversationTurn,
  virtualGuideName: string,
): string {
  return turn.speaker === "virtualGuide"
    ? getVirtualGuideTurnLabel(virtualGuideName)
    : "You";
}

// ---------------------------------------------------------------------------
// Fixed Compass, Waypoint, and conversation data
// ---------------------------------------------------------------------------

const COMPASS_PATH_DATA: Readonly<Record<CompassPathId, CompassPath>> = freeze({
  "understand-need": freeze<CompassPath>({
    id: "understand-need",
    label: "Understand what I need",
    labelLines: freeze(["Understand", "what I need"]) as readonly [string, string],
    homeZone: "priority",
  }),
  timing: freeze<CompassPath>({
    id: "timing",
    label: "Timing the conversation",
    labelLines: freeze(["Timing the", "conversation"]) as readonly [string, string],
    homeZone: "detourRight",
  }),
  "avoiding-conflict": freeze<CompassPath>({
    id: "avoiding-conflict",
    label: "Avoiding conflict",
    labelLines: freeze(["Avoiding", "conflict"]) as readonly [string, string],
    homeZone: "detourLeft",
  }),
  afterward: freeze<CompassPath>({
    id: "afterward",
    label: "What happens afterward",
    labelLines: freeze(["What happens", "afterward"]) as readonly [string, string],
    homeZone: "excursion",
  }),
});

export const COMPASS_PATHS: readonly CompassPath[] = freeze([
  COMPASS_PATH_DATA["understand-need"],
  COMPASS_PATH_DATA.timing,
  COMPASS_PATH_DATA["avoiding-conflict"],
  COMPASS_PATH_DATA.afterward,
]);

export const COMPASS_ZONE_LABELS: Readonly<Record<CompassZone, string>> = freeze({
  priority: "Priority",
  detourLeft: "Detour",
  detourRight: "Detour",
  excursion: "Excursion",
});

const WAYPOINT_DETAIL_DATA: Readonly<Record<WaypointDetailId, WaypointDetail>> =
  freeze({
    "insight-clarity": freeze<WaypointDetail>({
      id: "insight-clarity",
      kind: "keyInsight",
      text: "Clarity needs to come before finding the right words.",
    }),
    "evidence-describe-need": freeze<WaypointDetail>({
      id: "evidence-describe-need",
      kind: "arrivalEvidence",
      text: "I can describe the need I want understood.",
    }),
    "evidence-name-need": freeze<WaypointDetail>({
      id: "evidence-name-need",
      kind: "arrivalEvidence",
      text: "Name the one need I most want them to understand.",
    }),
  });

export const WAYPOINT_DETAILS: readonly WaypointDetail[] = freeze([
  WAYPOINT_DETAIL_DATA["insight-clarity"],
  WAYPOINT_DETAIL_DATA["evidence-describe-need"],
  WAYPOINT_DETAIL_DATA["evidence-name-need"],
]);

export const WAYPOINT_DETAIL_KIND_LABELS: Readonly<
  Record<WaypointDetailKind, string>
> = freeze({
  keyInsight: "Key Insight",
  arrivalEvidence: "Arrival evidence",
});

// Each quotation text is an exact excerpt of its source turn.
export const SUPPORTING_QUOTATIONS: readonly SupportingQuotation[] = freeze([
  freeze<SupportingQuotation>({
    id: "quote-clarity-guide",
    detailId: "insight-clarity",
    turnId: "turn-3",
    text: "understanding your own needs might come before preparing what to say",
    status: "current",
  }),
  freeze<SupportingQuotation>({
    id: "quote-clarity-explorer",
    detailId: "insight-clarity",
    turnId: "turn-4",
    text: "I mostly want to understand what I need before I talk to them.",
    status: "current",
  }),
  freeze<SupportingQuotation>({
    id: "quote-describe-current",
    detailId: "evidence-describe-need",
    turnId: "turn-6",
    text: "I think I could describe what I need if I had a little time.",
    status: "current",
  }),
  freeze<SupportingQuotation>({
    id: "quote-describe-earlier",
    detailId: "evidence-describe-need",
    turnId: "turn-2",
    text: "I don't know how to explain what I need.",
    status: "superseded",
  }),
  freeze<SupportingQuotation>({
    id: "quote-name-need",
    detailId: "evidence-name-need",
    turnId: "turn-6",
    text: "I also want to identify the one thing I most need them to understand.",
    status: "current",
  }),
]);

export const OPENING_TOPIC_CHOICES: readonly ConversationChoice[] = freeze([
  freeze<ConversationChoice>({
    id: "difficult-conversation",
    label: "Preparing for the difficult conversation",
    tag: "Recommended",
    group: "continue",
    topic: "preparing for the difficult conversation",
  }),
  freeze<ConversationChoice>({
    id: "others-understand",
    label: "What I need others to understand",
    tag: "From earlier",
    group: "continue",
    topic: "what I need others to understand",
  }),
  freeze<ConversationChoice>({
    id: "relationship",
    label: "A relationship on my mind",
    tag: null,
    group: "new",
    topic: "a relationship on my mind",
  }),
  freeze<ConversationChoice>({
    id: "decision",
    label: "A decision I am weighing",
    tag: null,
    group: "new",
    topic: "a decision I am weighing",
  }),
  freeze<ConversationChoice>({
    id: "feeling-lately",
    label: "How I have been feeling lately",
    tag: null,
    group: "new",
    topic: "how I have been feeling lately",
  }),
]);

export const OPENING_SOMETHING_ELSE_CHOICE: ConversationChoice =
  freeze<ConversationChoice>({
    id: "opening-something-else",
    label: "I would like to talk about something else",
    tag: null,
    group: "somethingElse",
    topic: null,
  });

export const FOLLOW_UP_CHOICES: readonly ConversationChoice[] = freeze([
  freeze<ConversationChoice>({
    id: "follow-up-stay",
    label: "Stay with this topic",
    tag: null,
    group: "followUp",
    topic: "staying with this topic a little longer",
  }),
  freeze<ConversationChoice>({
    id: "follow-up-timing",
    label: "Explore timing the conversation",
    tag: null,
    group: "followUp",
    topic: "when to have the conversation",
  }),
  freeze<ConversationChoice>({
    id: "follow-up-afterward",
    label: "Consider what happens afterward",
    tag: null,
    group: "followUp",
    topic: "what may happen afterward",
  }),
]);

export const FOLLOW_UP_SOMETHING_ELSE_CHOICE: ConversationChoice =
  freeze<ConversationChoice>({
    id: "follow-up-something-else",
    label: "Something else",
    tag: null,
    group: "somethingElse",
    topic: null,
  });

const ALL_CONVERSATION_CHOICES: readonly ConversationChoice[] = freeze([
  ...OPENING_TOPIC_CHOICES,
  OPENING_SOMETHING_ELSE_CHOICE,
  ...FOLLOW_UP_CHOICES,
  FOLLOW_UP_SOMETHING_ELSE_CHOICE,
]);

export const VERIFICATION_ANSWER_LABELS: Readonly<
  Record<VerificationMode, Readonly<Record<VerificationAnswer, string>>>
> = freeze({
  capture: freeze({ yes: "Yes, capture that", no: "It's still forming" }),
  reopen: freeze({ yes: "Yes, reopen it", no: "Keep it Captured" }),
});

// Typed Explorer messages receive one of these, in order, regardless of what
// the Explorer wrote.
export const SCRIPTED_REPLIES: readonly string[] = freeze([
  "Thank you for putting that into words. Nothing on your Compass or in your Forming Waypoint changes unless you choose it or confirm it.",
  "We can stay with this as long as it helps. If part of it seems to belong in your Waypoint, I will ask before capturing anything, and you can say it is still forming.",
  "When you are ready, Pause keeps this screen as it is, and Finish & review lets you decide what this journey reached.",
]);

const INITIAL_ACTIVITY = `"Timing the conversation" is your current attention. Your Priority is still "Understand what I need".`;

const INITIAL_ORIENTATION_HISTORY: readonly CompassPathId[] = freeze([
  "understand-need",
  "afterward",
  "avoiding-conflict",
  "understand-need",
]);

export function getCompassPath(pathId: CompassPathId): CompassPath {
  return COMPASS_PATH_DATA[pathId];
}

export function getWaypointDetail(detailId: WaypointDetailId): WaypointDetail {
  return WAYPOINT_DETAIL_DATA[detailId];
}

export function getSupportingQuotation(
  quotationId: QuotationId,
): SupportingQuotation | null {
  return SUPPORTING_QUOTATIONS.find((quote) => quote.id === quotationId) ?? null;
}

export function getQuotationsForDetail(
  detailId: WaypointDetailId,
): readonly SupportingQuotation[] {
  return SUPPORTING_QUOTATIONS.filter((quote) => quote.detailId === detailId);
}

function findConversationChoice(
  choiceId: ConversationChoiceId,
): ConversationChoice | null {
  return ALL_CONVERSATION_CHOICES.find((choice) => choice.id === choiceId) ?? null;
}

function withoutFinalPeriod(text: string): string {
  return text.endsWith(".") ? text.slice(0, -1) : text;
}

// ---------------------------------------------------------------------------
// State construction
// ---------------------------------------------------------------------------

type TurnOptions = Readonly<{
  offersOpeningChoices?: boolean;
  offersFollowUpChoices?: boolean;
  verification?: TurnVerification | null;
}>;

function createTurn(
  id: string,
  speaker: TurnSpeaker,
  origin: TurnOrigin,
  body: string,
  options: TurnOptions = {},
): ConversationTurn {
  return freeze<ConversationTurn>({
    id,
    speaker,
    origin,
    body,
    offersOpeningChoices: options.offersOpeningChoices ?? false,
    offersFollowUpChoices: options.offersFollowUpChoices ?? false,
    verification: options.verification
      ? freeze<TurnVerification>({ ...options.verification })
      : null,
  });
}

function createScenarioTurns(): ConversationTurn[] {
  return [
    createTurn(
      "turn-1",
      "virtualGuide",
      "scenario",
      "For today's reflection journey, what feels most useful to explore?",
      { offersOpeningChoices: true },
    ),
    createTurn(
      "turn-2",
      "explorer",
      "scenario",
      "I've been avoiding a difficult conversation because I don't know how to explain what I need.",
    ),
    createTurn(
      "turn-3",
      "virtualGuide",
      "scenario",
      "It sounds like understanding your own needs might come before preparing what to say. Does that feel accurate?",
    ),
    createTurn(
      "turn-4",
      "explorer",
      "scenario",
      "Yes. I mostly want to understand what I need before I talk to them.",
    ),
    createTurn(
      "turn-5",
      "virtualGuide",
      "scenario",
      "Thank you for confirming. I captured that as a Key Insight: clarity needs to come before finding the right words. Could you describe the need you want them to understand, even roughly?",
    ),
    createTurn(
      "turn-6",
      "explorer",
      "scenario",
      "I think I could describe what I need if I had a little time. I also want to identify the one thing I most need them to understand. And I need to decide when to have the conversation - I don't want to rush into it.",
    ),
    createTurn(
      "turn-7",
      "virtualGuide",
      "scenario",
      'Would you like me to capture "I can describe the need I want understood" as part of this Waypoint, or is it still forming?',
      {
        verification: {
          detailId: "evidence-describe-need",
          mode: "capture",
          answer: "yes",
        },
      },
    ),
    createTurn(
      "turn-8",
      "virtualGuide",
      "scenario",
      'Thank you. That detail is Captured. Should I also capture "Name the one need I most want them to understand," or is that still forming? Deciding when to have the conversation stays on your Compass for now.',
      {
        verification: {
          detailId: "evidence-name-need",
          mode: "capture",
          answer: null,
        },
      },
    ),
  ];
}

function createOpenConversationTurns(): ConversationTurn[] {
  return [
    createTurn(
      "turn-1",
      "virtualGuide",
      "scenario",
      "What would feel useful to talk about today? We can begin without choosing a Waypoint. If something reachable starts to take shape, you decide whether it becomes one.",
      { offersOpeningChoices: true },
    ),
  ];
}

function buildState(next: ExplorerConversationState): ExplorerConversationState {
  return freeze<ExplorerConversationState>({
    ...next,
    turns: freeze([...next.turns]),
    orientationHistory: freeze([...next.orientationHistory]),
    detailStates: freeze({ ...next.detailStates }),
    openQuotationDetailIds: freeze([...next.openQuotationDetailIds]),
    supportPanel: freeze({ ...next.supportPanel }),
  });
}

function update(
  state: ExplorerConversationState,
  patch: Partial<ExplorerConversationState>,
): ExplorerConversationState {
  return buildState({ ...state, ...patch });
}

function withDetailState(
  states: Readonly<Record<WaypointDetailId, WaypointDetailState>>,
  detailId: WaypointDetailId,
  value: WaypointDetailState,
): Readonly<Record<WaypointDetailId, WaypointDetailState>> {
  const next: Record<WaypointDetailId, WaypointDetailState> = { ...states };
  next[detailId] = value;
  return next;
}

function nextTurnId(turns: readonly ConversationTurn[], offset = 0): string {
  return `turn-${turns.length + 1 + offset}`;
}

export function createInitialExplorerConversationState(): ExplorerConversationState {
  return buildState({
    conversationKind: "retainedScenario",
    view: "journey",
    phase: "active",
    outcome: null,
    conversationVisibility: "private",
    waypointVisibility: "private",
    turns: createScenarioTurns(),
    selectedChoiceId: null,
    composerDraft: "",
    composerPrompt: "default",
    composerError: null,
    virtualGuideName: DEFAULT_VIRTUAL_GUIDE_NAME,
    renameDraft: null,
    attentionPathId: "timing",
    priorityPathId: "understand-need",
    priorityConfirmed: true,
    pendingPriorityPathId: null,
    orientationHistory: INITIAL_ORIENTATION_HISTORY,
    compassView: "full",
    waypointStatus: "forming",
    detailStates: {
      "insight-clarity": "captured",
      "evidence-describe-need": "captured",
      "evidence-name-need": "forming",
    },
    openQuotationDetailIds: [],
    sourceHighlight: null,
    supportPanel: { wideVisible: true, narrowOpen: false },
    navigationMenuOpen: false,
    dialog: null,
    activity: INITIAL_ACTIVITY,
  });
}

function canChangeJourney(state: ExplorerConversationState): boolean {
  return state.view === "journey" && state.phase === "active";
}

// ---------------------------------------------------------------------------
// Navigation, dialogs, and reset
// ---------------------------------------------------------------------------

// Opening a dialog leaves the narrow menu as it was, so focus can return to
// the exact control that opened the dialog.
function openDialog(
  state: ExplorerConversationState,
  dialog: PrototypeDialog,
): ExplorerConversationState {
  return update(state, { dialog: freeze(dialog) });
}

export function activatePrimaryNavigation(
  state: ExplorerConversationState,
  destinationId: PrimaryDestinationId,
): ExplorerConversationState {
  if (destinationId === "conversations") {
    if (state.view === "conversations" && !state.navigationMenuOpen) {
      return state;
    }

    return update(state, {
      view: "conversations",
      navigationMenuOpen: false,
      sourceHighlight: null,
      activity: "Showing your conversations.",
    });
  }

  return openDialog(state, { kind: "notConnected", destination: destinationId });
}

export function activateConversationSpace(
  state: ExplorerConversationState,
  spaceId: ConversationSpaceId,
): ExplorerConversationState {
  if (spaceId === "guide") {
    return openDialog(state, {
      kind: "notConnected",
      destination: GUIDE_CONVERSATIONS_DESTINATION,
    });
  }

  if (state.view === "journey" && !state.navigationMenuOpen) {
    return state;
  }

  return update(state, {
    view: "journey",
    navigationMenuOpen: false,
    activity: `Opened ${JOURNEY_TITLE}.`,
  });
}

export function toggleNavigationMenu(
  state: ExplorerConversationState,
): ExplorerConversationState {
  return update(state, { navigationMenuOpen: !state.navigationMenuOpen });
}

export function closeNavigationMenu(
  state: ExplorerConversationState,
): ExplorerConversationState {
  return state.navigationMenuOpen
    ? update(state, { navigationMenuOpen: false })
    : state;
}

export function openNotConnectedDestination(
  state: ExplorerConversationState,
  destination: NotConnectedDestinationId,
): ExplorerConversationState {
  return openDialog(state, { kind: "notConnected", destination });
}

export function openConversationSharingInfo(
  state: ExplorerConversationState,
): ExplorerConversationState {
  return openDialog(state, { kind: "conversationSharing" });
}

export function openWaypointSharingInfo(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (state.waypointStatus !== "reached") {
    return state;
  }

  return openDialog(state, { kind: "waypointSharing" });
}

export function openQuotationSharingInfo(
  state: ExplorerConversationState,
  quotationId: QuotationId,
): ExplorerConversationState {
  return getSupportingQuotation(quotationId)
    ? openDialog(state, { kind: "quotationSharing", quotationId })
    : state;
}

export function openAboutPrototype(
  state: ExplorerConversationState,
): ExplorerConversationState {
  return openDialog(state, { kind: "aboutPrototype" });
}

export function requestPrototypeReset(
  state: ExplorerConversationState,
): ExplorerConversationState {
  return openDialog(state, { kind: "resetConfirmation" });
}

export function closePrototypeDialog(
  state: ExplorerConversationState,
): ExplorerConversationState {
  return state.dialog === null ? state : update(state, { dialog: null });
}

// Reset happens only from the open confirmation and returns the exact initial
// state. Focus then returns to RESET_FOCUS_TARGET_ID.
export function confirmPrototypeReset(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (state.dialog?.kind !== "resetConfirmation") {
    return state;
  }

  return createInitialExplorerConversationState();
}

export function returnToConversationsFromSummary(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (state.phase !== "finished" || state.view !== "journey") {
    return state;
  }

  return update(state, {
    view: "conversations",
    sourceHighlight: null,
    activity:
      state.conversationKind === "openEnded"
        ? "Your conversation is finished and listed with your conversations on this screen."
        : `${JOURNEY_TITLE} is finished and listed with your conversations on this screen.`,
  });
}

function createOpenEndedConversationState(
  virtualGuideName = DEFAULT_VIRTUAL_GUIDE_NAME,
): ExplorerConversationState {
  return buildState({
    conversationKind: "openEnded",
    view: "journey",
    phase: "active",
    outcome: null,
    conversationVisibility: "private",
    waypointVisibility: "private",
    turns: createOpenConversationTurns(),
    selectedChoiceId: null,
    composerDraft: "",
    composerPrompt: "default",
    composerError: null,
    virtualGuideName,
    renameDraft: null,
    attentionPathId: "understand-need",
    priorityPathId: "understand-need",
    priorityConfirmed: false,
    pendingPriorityPathId: null,
    orientationHistory: freeze(["understand-need"]),
    compassView: "full",
    waypointStatus: "none",
    detailStates: {
      "insight-clarity": "forming",
      "evidence-describe-need": "forming",
      "evidence-name-need": "forming",
    },
    openQuotationDetailIds: [],
    sourceHighlight: null,
    supportPanel: { wideVisible: true, narrowOpen: false },
    navigationMenuOpen: false,
    dialog: null,
    activity: "New private conversation started. No Waypoint has been chosen.",
  });
}

export function requestNewConversation(
  state: ExplorerConversationState,
): ExplorerConversationState {
  return openDialog(state, { kind: "newConversationConfirmation" });
}

export function confirmStartNewConversation(
  state: ExplorerConversationState,
): ExplorerConversationState {
  return state.dialog?.kind === "newConversationConfirmation"
    ? createOpenEndedConversationState(state.virtualGuideName)
    : state;
}

export function openJourneyFromConversations(
  state: ExplorerConversationState,
): ExplorerConversationState {
  return activateConversationSpace(state, "virtualGuide");
}

// ---------------------------------------------------------------------------
// Virtual Guide name
// ---------------------------------------------------------------------------

export function openVirtualGuideRename(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (state.renameDraft !== null) {
    return state;
  }

  return update(state, { renameDraft: state.virtualGuideName });
}

export function updateVirtualGuideRenameDraft(
  state: ExplorerConversationState,
  draft: string,
): ExplorerConversationState {
  if (state.renameDraft === null || state.renameDraft === draft) {
    return state;
  }

  return update(state, {
    renameDraft: draft.slice(0, VIRTUAL_GUIDE_NAME_MAX_LENGTH),
  });
}

export function saveVirtualGuideRename(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (state.renameDraft === null) {
    return state;
  }

  const name = normalizeVirtualGuideName(state.renameDraft);

  return update(state, {
    virtualGuideName: name,
    renameDraft: null,
    activity: name
      ? `Your Virtual Guide is now called ${name} on this screen.`
      : `Your Virtual Guide is now called ${SOLMIND_TERMS.virtualGuide} on this screen.`,
  });
}

export function cancelVirtualGuideRename(
  state: ExplorerConversationState,
): ExplorerConversationState {
  return state.renameDraft === null ? state : update(state, { renameDraft: null });
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

export function validateComposerMessage(rawText: string): ComposerValidation {
  const text = rawText.trim();

  if (!text) {
    return { ok: false, reason: "blank" };
  }

  if (text.length > COMPOSER_MESSAGE_MAX_LENGTH) {
    return { ok: false, reason: "tooLong" };
  }

  return { ok: true, text };
}

export function describeComposerError(error: ComposerError): string {
  return error === "blank"
    ? "Type a message before sending."
    : `Messages can be up to ${COMPOSER_MESSAGE_MAX_LENGTH} characters.`;
}

export function hasFollowUpChoices(state: ExplorerConversationState): boolean {
  return state.turns.some((turn) => turn.offersFollowUpChoices);
}

// Selecting a choice only prepares the composer. Nothing is sent until the
// Explorer sends the message.
export function selectConversationChoice(
  state: ExplorerConversationState,
  choiceId: ConversationChoiceId,
): ExplorerConversationState {
  const choice = findConversationChoice(choiceId);

  if (!choice || !canChangeJourney(state)) {
    return state;
  }

  const isFollowUpChoice =
    choice.group === "followUp" || choice.id === "follow-up-something-else";

  if (isFollowUpChoice && !hasFollowUpChoices(state)) {
    return state;
  }

  if (choice.topic === null) {
    return update(state, {
      selectedChoiceId: choice.id,
      composerDraft: "",
      composerPrompt: "somethingElse",
      composerError: null,
      activity: "Something else selected. Start wherever feels useful.",
    });
  }

  return update(state, {
    selectedChoiceId: choice.id,
    composerDraft: `I'd like to talk about ${choice.topic}.`,
    composerPrompt: "default",
    composerError: null,
    activity: "Starting topic selected. You can edit the message before sending it.",
  });
}

export function updateComposerDraft(
  state: ExplorerConversationState,
  draft: string,
): ExplorerConversationState {
  if (!canChangeJourney(state) || state.composerDraft === draft) {
    return state;
  }

  return update(state, { composerDraft: draft, composerError: null });
}

export function exploreNextDirection(
  state: ExplorerConversationState,
  layout: SupportLayout,
): ExplorerConversationState {
  if (!canChangeJourney(state)) {
    return state;
  }

  const hasDraft = state.composerDraft.trim().length > 0;

  return update(state, {
    composerDraft: hasDraft
      ? state.composerDraft
      : EXPLORE_NEXT_DIRECTION_DRAFT,
    composerPrompt: "default",
    composerError: null,
    selectedChoiceId: null,
    supportPanel:
      layout === "narrow"
        ? { ...state.supportPanel, narrowOpen: false }
        : state.supportPanel,
    activity: hasDraft
      ? "Your unsent draft was kept. Nothing was sent, and no Waypoint was created or changed."
      : "A draft was added for you to edit. Nothing was sent, and no Waypoint was created or changed.",
  });
}

export function submitComposerMessage(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (!canChangeJourney(state)) {
    return state;
  }

  const validation = validateComposerMessage(state.composerDraft);

  if (!validation.ok) {
    return state.composerError === validation.reason
      ? state
      : update(state, { composerError: validation.reason });
  }

  const replyIndex =
    state.turns.filter((turn) => turn.origin === "scriptedReply").length %
    SCRIPTED_REPLIES.length;
  const explorerTurn = createTurn(
    nextTurnId(state.turns),
    "explorer",
    "explorerMessage",
    validation.text,
  );
  const replyTurn = createTurn(
    nextTurnId(state.turns, 1),
    "virtualGuide",
    "scriptedReply",
    state.waypointStatus === "none"
      ? "Thank you for sharing that. We can keep exploring without choosing a Waypoint. If something reachable begins to matter, I will ask before treating it as one."
      : SCRIPTED_REPLIES[replyIndex],
  );

  return update(state, {
    turns: [...state.turns, explorerTurn, replyTurn],
    composerDraft: "",
    composerPrompt: "default",
    composerError: null,
    selectedChoiceId: null,
    activity: `Your message was added. ${getVirtualGuideTurnLabel(state.virtualGuideName)} answered with a fixed prototype reply; your Compass and Waypoint did not change.`,
  });
}

export function getOpenVerificationTurn(
  state: ExplorerConversationState,
): ConversationTurn | null {
  return (
    state.turns.find(
      (turn) => turn.verification !== null && turn.verification.answer === null,
    ) ?? null
  );
}

function verificationPromptBody(
  detail: WaypointDetail,
  mode: VerificationMode,
): string {
  const quoted = `"${withoutFinalPeriod(detail.text)}"`;

  return mode === "capture"
    ? `Would you like me to capture ${quoted} as part of this Waypoint, or is it still forming?`
    : `${quoted} is Captured right now. Would you like to reopen it as Forming so we can keep shaping it together?`;
}

function verificationReplyBody(
  detail: WaypointDetail,
  mode: VerificationMode,
  answer: VerificationAnswer,
): string {
  const quoted = `"${withoutFinalPeriod(detail.text)}"`;

  if (mode === "capture") {
    return answer === "yes"
      ? `Captured ${quoted}. Where would you like to go next?`
      : `That is fine. ${quoted} stays Forming, and we can keep shaping it whenever you are ready.`;
  }

  return answer === "yes"
    ? `I reopened ${quoted} as Forming. We can keep shaping it together.`
    : `Understood. ${quoted} stays Captured.`;
}

function verificationActivity(
  detail: WaypointDetail,
  mode: VerificationMode,
  answer: VerificationAnswer,
): string {
  const quoted = `"${withoutFinalPeriod(detail.text)}"`;

  if (mode === "capture") {
    return answer === "yes"
      ? `You confirmed ${quoted} in the conversation, so it is now Captured. New choices appeared in the conversation.`
      : `${quoted} stays Forming.`;
  }

  return answer === "yes"
    ? `You reopened ${quoted} in the conversation, so it is Forming again.`
    : `${quoted} stays Captured.`;
}

// Waypoint details change only through an Explorer answer to a conversation
// question. There is no direct freeform editing path.
export function answerDetailVerification(
  state: ExplorerConversationState,
  turnId: string,
  answer: VerificationAnswer,
): ExplorerConversationState {
  if (!canChangeJourney(state)) {
    return state;
  }

  const index = state.turns.findIndex((turn) => turn.id === turnId);
  const turn = index >= 0 ? state.turns[index] : null;
  const verification = turn?.verification ?? null;

  if (!turn || !verification || verification.answer !== null) {
    return state;
  }

  const detail = WAYPOINT_DETAIL_DATA[verification.detailId];
  const nextDetailState: WaypointDetailState =
    verification.mode === "capture"
      ? answer === "yes"
        ? "captured"
        : "forming"
      : answer === "yes"
        ? "forming"
        : "captured";
  const answeredTurn = createTurn(turn.id, turn.speaker, turn.origin, turn.body, {
    offersOpeningChoices: turn.offersOpeningChoices,
    offersFollowUpChoices: turn.offersFollowUpChoices,
    verification: { ...verification, answer },
  });
  const turns = state.turns.map((candidate, candidateIndex) =>
    candidateIndex === index ? answeredTurn : candidate,
  );
  const replyTurn = createTurn(
    nextTurnId(turns),
    "virtualGuide",
    "verificationReply",
    verificationReplyBody(detail, verification.mode, answer),
    {
      offersFollowUpChoices:
        verification.mode === "capture" && answer === "yes",
    },
  );

  return update(state, {
    turns: [...turns, replyTurn],
    detailStates: withDetailState(state.detailStates, detail.id, nextDetailState),
    activity: verificationActivity(detail, verification.mode, answer),
  });
}

// The Explorer asks for a detail to be verified or revisited; the Virtual
// Guide raises it as a question inside the conversation.
export function startDetailVerification(
  state: ExplorerConversationState,
  detailId: WaypointDetailId,
  layout: SupportLayout,
): ExplorerConversationState {
  if (
    state.waypointStatus === "none" ||
    !canChangeJourney(state) ||
    getOpenVerificationTurn(state) !== null
  ) {
    return state;
  }

  const detail = WAYPOINT_DETAIL_DATA[detailId];
  const mode: VerificationMode =
    state.detailStates[detailId] === "forming" ? "capture" : "reopen";
  const turn = createTurn(
    nextTurnId(state.turns),
    "virtualGuide",
    "verificationPrompt",
    verificationPromptBody(detail, mode),
    { verification: { detailId, mode, answer: null } },
  );

  return update(state, {
    turns: [...state.turns, turn],
    supportPanel:
      layout === "narrow"
        ? { ...state.supportPanel, narrowOpen: false }
        : state.supportPanel,
    activity: `${getVirtualGuideTurnLabel(state.virtualGuideName)} asked about "${withoutFinalPeriod(detail.text)}" in the conversation.`,
  });
}

export function goToOpenVerification(
  state: ExplorerConversationState,
  layout: SupportLayout,
): ExplorerConversationState {
  if (getOpenVerificationTurn(state) === null) {
    return state;
  }

  return layout === "narrow" ? closeSupportDrawer(state) : state;
}

export function getLatestTurnId(state: ExplorerConversationState): string {
  return state.turns[state.turns.length - 1].id;
}

// ---------------------------------------------------------------------------
// Compass: attention versus explicitly confirmed Priority
// ---------------------------------------------------------------------------

export function selectCompassPath(
  state: ExplorerConversationState,
  pathId: CompassPathId,
): ExplorerConversationState {
  if (!canChangeJourney(state) || state.attentionPathId === pathId) {
    return state;
  }

  const hadOpenQuestion = state.pendingPriorityPathId !== null;
  const path = COMPASS_PATH_DATA[pathId];
  const priority = COMPASS_PATH_DATA[state.priorityPathId];

  return update(state, {
    attentionPathId: pathId,
    pendingPriorityPathId: null,
    orientationHistory: [state.attentionPathId, ...state.orientationHistory],
    activity: [
      `Current attention moved to "${path.label}".`,
      state.priorityConfirmed
        ? `Your Priority is still "${priority.label}".`
        : "No Priority has been confirmed yet.",
      hadOpenQuestion ? "The open Priority question closed without a change." : "",
    ]
      .filter(Boolean)
      .join(" "),
  });
}

export function requestPriorityChange(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (
    !canChangeJourney(state) ||
    (state.priorityConfirmed && state.attentionPathId === state.priorityPathId) ||
    state.pendingPriorityPathId !== null
  ) {
    return state;
  }

  return update(state, {
    pendingPriorityPathId: state.attentionPathId,
    activity: `Confirm whether "${COMPASS_PATH_DATA[state.attentionPathId].label}" should become your Priority. Nothing changes unless you confirm.`,
  });
}

export function confirmPriorityChange(
  state: ExplorerConversationState,
): ExplorerConversationState {
  const pending = state.pendingPriorityPathId;

  if (!canChangeJourney(state) || pending === null) {
    return state;
  }

  return update(state, {
    priorityPathId: pending,
    priorityConfirmed: true,
    pendingPriorityPathId: null,
    activity:
      state.waypointStatus === "none"
        ? `You confirmed "${COMPASS_PATH_DATA[pending].label}" as your Priority. No Waypoint has been chosen.`
        : `You confirmed "${COMPASS_PATH_DATA[pending].label}" as your Priority. Your Forming Waypoint did not change.`,
  });
}

export function declinePriorityChange(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (state.pendingPriorityPathId === null) {
    return state;
  }

  return update(state, {
    pendingPriorityPathId: null,
    activity: state.priorityConfirmed
      ? `No change. "${COMPASS_PATH_DATA[state.priorityPathId].label}" is still your Priority.`
      : "No Priority was chosen.",
  });
}

export function toggleCompassView(
  state: ExplorerConversationState,
): ExplorerConversationState {
  return update(state, {
    compassView: state.compassView === "full" ? "compact" : "full",
  });
}

// The Priority always occupies the upper zone of the fixed frame. A path
// displaced from the upper zone takes the zone the new Priority vacated.
export function getCompassLayout(
  state: ExplorerConversationState,
): readonly CompassLayoutItem[] {
  const priorityHomeZone = COMPASS_PATH_DATA[state.priorityPathId].homeZone;

  return COMPASS_PATHS.map((path) => {
    let zone: CompassZone = path.homeZone;

    if (state.priorityConfirmed && path.id === state.priorityPathId) {
      zone = "priority";
    } else if (state.priorityConfirmed && path.homeZone === "priority") {
      zone = priorityHomeZone;
    }

    return freeze<CompassLayoutItem>({
      path,
      zone,
      zoneLabel: COMPASS_ZONE_LABELS[zone],
      isPriority: state.priorityConfirmed && path.id === state.priorityPathId,
      isAttention: path.id === state.attentionPathId,
      isPendingPriority: path.id === state.pendingPriorityPathId,
    });
  });
}

export function getCompassDescription(state: ExplorerConversationState): string {
  const layout = getCompassLayout(state);
  const priority = layout.find((item) => item.isPriority);
  const attention = layout.find((item) => item.isAttention);
  const others = layout
    .filter((item) => !item.isPriority && !item.isAttention)
    .map((item) => `${item.path.label} is a ${item.zoneLabel}.`);

  return [
    !state.priorityConfirmed ? "No Priority has been confirmed." : "",
    priority ? `${priority.path.label} is your confirmed Priority.` : "",
    attention && !attention.isPriority
      ? `${attention.path.label} holds your current attention, in the ${attention.zoneLabel} area.`
      : "",
    attention?.isPriority ? "Your current attention is on your Priority." : "",
    ...others,
  ]
    .filter(Boolean)
    .join(" ");
}

export type CompactOrientations = Readonly<{
  current: CompassPath;
  recent: readonly CompassPath[];
  moreCount: number;
}>;

export function getCompactOrientations(
  state: ExplorerConversationState,
): CompactOrientations {
  return freeze({
    current: COMPASS_PATH_DATA[state.attentionPathId],
    recent: freeze(
      state.orientationHistory
        .slice(0, COMPACT_RECENT_ORIENTATION_LIMIT)
        .map((pathId) => COMPASS_PATH_DATA[pathId]),
    ),
    moreCount: Math.max(
      state.orientationHistory.length - COMPACT_RECENT_ORIENTATION_LIMIT,
      0,
    ),
  });
}

// ---------------------------------------------------------------------------
// Supporting panel, responsive drawer, and quotation source navigation
// ---------------------------------------------------------------------------

export function toggleSupportPanel(
  state: ExplorerConversationState,
  layout: SupportLayout,
): ExplorerConversationState {
  return update(state, {
    supportPanel:
      layout === "wide"
        ? { ...state.supportPanel, wideVisible: !state.supportPanel.wideVisible }
        : { ...state.supportPanel, narrowOpen: !state.supportPanel.narrowOpen },
  });
}

export function closeSupportDrawer(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (!state.supportPanel.narrowOpen) {
    return state;
  }

  return update(state, {
    supportPanel: { ...state.supportPanel, narrowOpen: false },
  });
}

export type SupportPanelToggle = Readonly<{
  expanded: boolean;
  label: string;
}>;

export function getSupportPanelToggle(
  state: ExplorerConversationState,
  layout: SupportLayout,
): SupportPanelToggle {
  if (layout === "wide") {
    return {
      expanded: state.supportPanel.wideVisible,
      label: state.supportPanel.wideVisible
        ? "Hide Compass & Waypoint"
        : "Show Compass & Waypoint",
    };
  }

  return {
    expanded: state.supportPanel.narrowOpen,
    label: state.supportPanel.narrowOpen
      ? "Close Compass & Waypoint"
      : "Show Compass & Waypoint",
  };
}

export type PriorityDisplay = Readonly<{
  confirmed: boolean;
  label: string;
}>;

export function getPriorityDisplay(
  state: ExplorerConversationState,
): PriorityDisplay {
  return freeze({
    confirmed: state.priorityConfirmed,
    label: state.priorityConfirmed
      ? COMPASS_PATH_DATA[state.priorityPathId].label
      : "No Priority confirmed",
  });
}

export type ActivityPlacement = "journey" | "drawer" | "conversations";

// The current change message renders in exactly one place.
export function getActivityPlacement(
  state: ExplorerConversationState,
  layout: SupportLayout,
): ActivityPlacement {
  if (state.view === "conversations") {
    return "conversations";
  }

  return layout === "narrow" && state.supportPanel.narrowOpen
    ? "drawer"
    : "journey";
}

export function setQuotationListOpen(
  state: ExplorerConversationState,
  detailId: WaypointDetailId,
  open: boolean,
): ExplorerConversationState {
  if (state.waypointStatus === "none") {
    return state;
  }

  const isOpen = state.openQuotationDetailIds.includes(detailId);

  if (isOpen === open) {
    return state;
  }

  return update(state, {
    openQuotationDetailIds: open
      ? [...state.openQuotationDetailIds, detailId]
      : state.openQuotationDetailIds.filter((id) => id !== detailId),
  });
}

export function selectSupportingQuotation(
  state: ExplorerConversationState,
  quotationId: QuotationId,
  layout: SupportLayout,
): ExplorerConversationState {
  if (state.waypointStatus === "none") {
    return state;
  }

  const quotation = getSupportingQuotation(quotationId);

  if (!quotation || state.view !== "journey") {
    return state;
  }

  const withList = setQuotationListOpen(state, quotation.detailId, true);

  return update(withList, {
    sourceHighlight: freeze({ turnId: quotation.turnId, quotationId }),
    supportPanel:
      layout === "narrow"
        ? { ...withList.supportPanel, narrowOpen: false }
        : withList.supportPanel,
    activity:
      quotation.status === "superseded"
        ? "Showing the earlier source of a superseded quotation. It is kept for history and is no longer the current basis."
        : "Showing the conversation turn this supporting quotation came from.",
  });
}

export function returnToSupportingQuotation(
  state: ExplorerConversationState,
  layout: SupportLayout,
): ExplorerConversationState {
  const highlight = state.sourceHighlight;
  const quotation = highlight ? getSupportingQuotation(highlight.quotationId) : null;

  if (!quotation || state.view !== "journey") {
    return state;
  }

  const withList = setQuotationListOpen(state, quotation.detailId, true);

  if (layout === "wide") {
    return withList.supportPanel.wideVisible
      ? withList
      : update(withList, {
          supportPanel: { ...withList.supportPanel, wideVisible: true },
        });
  }

  return withList.supportPanel.narrowOpen
    ? withList
    : update(withList, {
        supportPanel: { ...withList.supportPanel, narrowOpen: true },
      });
}

// Focus intent for quotation source navigation: the source turn receives
// focus after selection, and the quotation receives focus on return.
export function getQuotationSourceFocusTargetId(
  state: ExplorerConversationState,
): string | null {
  return state.sourceHighlight
    ? turnElementId(state.sourceHighlight.turnId)
    : null;
}

export function getQuotationReturnFocusTargetId(
  state: ExplorerConversationState,
): string | null {
  return state.sourceHighlight
    ? quotationElementId(state.sourceHighlight.quotationId)
    : null;
}

// ---------------------------------------------------------------------------
// Journey: Pause, Finish & review, and the stable summary
// ---------------------------------------------------------------------------

export function pauseJourney(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (!canChangeJourney(state)) {
    return state;
  }

  return update(state, {
    phase: "paused",
    pendingPriorityPathId: null,
    composerError: null,
    activity: "Journey paused on this screen. Nothing was finalized or shared. Refreshing or resetting clears this prototype.",
  });
}

export function resumeJourney(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (state.phase !== "paused") {
    return state;
  }

  return update(state, {
    phase: "active",
    activity:
      state.waypointStatus === "none"
        ? "Conversation resumed with its Compass. No Waypoint has been chosen."
        : "Journey resumed with its Compass, Forming Waypoint, Key Insights, and supporting quotations as you left them.",
  });
}

export function openFinishReview(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (state.phase !== "active" && state.phase !== "paused") {
    return state;
  }

  return update(state, {
    phase: "reviewing",
    pendingPriorityPathId: null,
    composerError: null,
    activity: "Final review opened. Nothing is finished or shared until you choose.",
  });
}

export function returnToConversationFromReview(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (state.phase !== "reviewing") {
    return state;
  }

  return update(state, {
    phase: "active",
    activity:
      state.waypointStatus === "none"
        ? "Returned to the conversation. No Waypoint has been chosen."
        : "Returned to the conversation. The Waypoint is still Forming.",
  });
}

export function finishKeepingWaypointForming(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (state.phase !== "reviewing") {
    return state;
  }

  return update(state, {
    phase: "finished",
    outcome: state.waypointStatus === "none" ? "noWaypoint" : "keptForming",
    activity:
      state.waypointStatus === "none"
        ? "Conversation finished on this screen without a Waypoint. Nothing was saved or shared."
        : "Journey finished on this screen. The Waypoint is still Forming for a later conversation. Nothing was saved or shared.",
  });
}

export function confirmWaypointReached(
  state: ExplorerConversationState,
): ExplorerConversationState {
  if (state.phase !== "reviewing" || state.waypointStatus === "none") {
    return state;
  }

  return update(state, {
    phase: "finished",
    outcome: "reached",
    waypointStatus: "reached",
    activity: "You confirmed the Waypoint as Reached on this screen. Nothing was saved or shared.",
  });
}

export type WaypointCounts = Readonly<{
  keyInsights: number;
  capturedDetails: number;
  formingDetails: number;
}>;

export function getWaypointCounts(state: ExplorerConversationState): WaypointCounts {
  if (state.waypointStatus === "none") {
    return freeze({ keyInsights: 0, capturedDetails: 0, formingDetails: 0 });
  }

  const evidence = WAYPOINT_DETAILS.filter(
    (detail) => detail.kind === "arrivalEvidence",
  );

  return freeze({
    keyInsights: WAYPOINT_DETAILS.filter((detail) => detail.kind === "keyInsight")
      .length,
    capturedDetails: evidence.filter(
      (detail) => state.detailStates[detail.id] === "captured",
    ).length,
    formingDetails: evidence.filter(
      (detail) => state.detailStates[detail.id] === "forming",
    ).length,
  });
}

export function formatWaypointCounts(counts: WaypointCounts): string {
  return [
    `${counts.formingDetails} forming`,
    `${counts.capturedDetails} captured detail${counts.capturedDetails === 1 ? "" : "s"}`,
    `${counts.keyInsights} Key Insight${counts.keyInsights === 1 ? "" : "s"}`,
  ].join(` ${MIDDLE_DOT} `);
}

export function getJourneyStatusLabel(state: ExplorerConversationState): string {
  switch (state.phase) {
    case "active":
      return state.waypointStatus === "none"
        ? "Active - no Waypoint chosen yet"
        : "Active and private";
    case "paused":
      return state.waypointStatus === "none"
        ? "Paused - no Waypoint chosen yet"
        : "Paused on this screen";
    case "reviewing":
      return "In final review - nothing is finished yet";
    case "finished":
      if (state.outcome === "noWaypoint") {
        return "Finished - no Waypoint chosen";
      }
      return state.outcome === "reached"
        ? "Finished - Waypoint Reached"
        : "Finished - Waypoint still Forming";
  }
}

export type JourneySummary = Readonly<{
  heading: string;
  outcome: string;
  priorityLabel: string;
  attentionLabel: string;
  countsLabel: string;
}>;

export function getJourneySummary(
  state: ExplorerConversationState,
): JourneySummary | null {
  if (state.phase !== "finished") {
    return null;
  }

  const reached = state.outcome === "reached";
  const noWaypoint = state.outcome === "noWaypoint";

  return freeze({
    heading: noWaypoint
      ? "Conversation finished without a Waypoint"
      : reached
      ? "Waypoint Reached"
      : "Journey finished - Waypoint still Forming",
    outcome: noWaypoint
      ? "You finished this conversation without choosing a Waypoint. A conversation can remain useful and complete without becoming one."
      : reached
      ? `You confirmed "${POTENTIAL_ARRIVAL}" as Reached. Its Key Insight and supporting quotations stay with it on this screen.`
      : `"${POTENTIAL_ARRIVAL}" is still Forming and can keep developing in a later conversation.`,
    priorityLabel: getPriorityDisplay(state).label,
    attentionLabel: COMPASS_PATH_DATA[state.attentionPathId].label,
    countsLabel: noWaypoint
      ? "No Waypoint chosen"
      : formatWaypointCounts(getWaypointCounts(state)),
  });
}
