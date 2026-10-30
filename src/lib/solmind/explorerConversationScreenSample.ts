// Written sample content for the interim /explorer/conversation-preview
// design review. Every item here is tagged "Sample" on the screen. Nothing is
// read from, or written to, any store; the screen only displays these values.
// Only the preview composition boundary (ExplorerConversationScreenPreview.tsx)
// imports this module; it passes the values to the parts as read-only props.

import { SOLMIND_TERMS } from "./terms";
import { MIDDLE_DOT, VIRTUAL_GUIDE_SHORT, guideLabel } from "./explorerConversationScreen";
import type {
  ConversationScreenData,
  ScreenChoice,
  ScreenCompass,
  ScreenCompassPoint,
  ScreenConversationSpace,
  ScreenNavigationItem,
  ScreenTurn,
  ScreenWaypoint,
} from "./explorerConversationScreenDisplay";

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

export const SAMPLE_EXPLORER_NAME = "Avery";
export const SAMPLE_GUIDE_NAME = "Jordan";
export const SAMPLE_GUIDE_LABEL = guideLabel(SAMPLE_GUIDE_NAME);
// OQ-8a (Mary or Nivan) is still open; Mary is the safe default.
export const SAMPLE_VIRTUAL_GUIDE_NAME = "Mary";

export const SAMPLE_NAVIGATION: readonly ScreenNavigationItem[] = freeze([
  freeze({ id: "overview", label: "Overview", shortLabel: "Overview", noteKey: "overview", current: false } as const),
  freeze({ id: "conversations", label: "Conversations", shortLabel: "Conversations", noteKey: "conversations", current: true } as const),
  freeze({ id: "waypoints", label: "Waypoints", shortLabel: "Waypoints", noteKey: "waypoints", current: false } as const),
  freeze({ id: "settings", label: "Settings", shortLabel: "Settings", noteKey: "settings", current: false } as const),
]);

export const SAMPLE_CONVERSATION_SPACES: readonly ScreenConversationSpace[] = freeze([
  freeze({
    id: "virtualGuide",
    label: `With your ${VIRTUAL_GUIDE_SHORT}`,
    description: "Private to you",
    noteKey: "virtualGuideSpace",
    current: true,
  } as const),
  freeze({
    id: "guide",
    label: `With ${SAMPLE_GUIDE_LABEL}`,
    description: "Direct conversations, a separate space",
    noteKey: "guideSpace",
    current: false,
  } as const),
]);

export const SAMPLE_PROFILE = freeze({
  name: SAMPLE_EXPLORER_NAME,
  role: SOLMIND_TERMS.explorerRole,
});

export const SAMPLE_HEADER = freeze({
  label: `Open conversation ${MIDDLE_DOT} with your ${VIRTUAL_GUIDE_SHORT}`,
  title: "Today's Reflection Journey",
  startedFrom: `Open reflection ${MIDDLE_DOT} Started from: What feels most important today?`,
  status: "Active and private",
  guideName: SAMPLE_GUIDE_NAME,
  virtualGuideName: SAMPLE_VIRTUAL_GUIDE_NAME,
  virtualGuidePrimaryLabel: `${SAMPLE_VIRTUAL_GUIDE_NAME} (${SOLMIND_TERMS.virtualGuide})`,
});

export const SAMPLE_SPEAKER_LABELS = freeze({
  virtualGuide: `${SAMPLE_VIRTUAL_GUIDE_NAME} (${VIRTUAL_GUIDE_SHORT})`,
  explorer: "You",
});

// From wireframe v6. The last turn is a question, so nothing is claimed as captured.
export const SAMPLE_TURNS: readonly ScreenTurn[] = freeze([
  freeze({
    id: "turn-1",
    speaker: "virtualGuide",
    body: "For today's reflection journey, what feels most useful to explore?",
    extra: "openingChoices",
  } as const),
  freeze({
    id: "turn-2",
    speaker: "explorer",
    body: "I've been avoiding a difficult conversation because I don't know how to explain what I need.",
    extra: null,
  } as const),
  freeze({
    id: "turn-3",
    speaker: "virtualGuide",
    body: "It sounds like understanding your own needs might come before preparing what to say. Does that feel accurate?",
    extra: null,
  } as const),
  freeze({
    id: "turn-4",
    speaker: "explorer",
    body: "Yes. I mostly want to understand what I need before I talk to them.",
    extra: null,
  } as const),
  freeze({
    id: "turn-5",
    speaker: "explorer",
    body: "I also want to identify the one thing I most need them to understand. And I need to decide when to have the conversation - I don't want to rush into it.",
    extra: null,
  } as const),
  freeze({
    id: "turn-6",
    speaker: "virtualGuide",
    body: 'Should I capture "Understand what I need first," or is it still forming? The timing can stay on your Compass for now.',
    extra: "check",
  } as const),
]);

export const SAMPLE_OPENING_CHOICES = freeze({
  continueOrRevisit: freeze([
    freeze({ id: "difficult-conversation", label: "Preparing for the difficult conversation", tag: "Recommended" }),
    freeze({ id: "others-understand", label: "What I need others to understand", tag: "From earlier" }),
  ] as ScreenChoice[]),
  startNew: freeze([
    freeze({ id: "relationship", label: "A relationship on my mind", tag: null }),
    freeze({ id: "decision", label: "A decision I am weighing", tag: null }),
    freeze({ id: "feeling-lately", label: "How I have been feeling lately", tag: null }),
  ] as ScreenChoice[]),
  somethingElse: "I would like to talk about something else",
});

export const SAMPLE_FOLLOW_UP_CHOICES: readonly ScreenChoice[] = freeze([
  freeze({ id: "follow-up-stay", label: "Stay with this topic", tag: null }),
  freeze({ id: "follow-up-timing", label: "Explore timing the conversation", tag: null }),
  freeze({ id: "follow-up-afterward", label: "Consider what happens afterward", tag: null }),
]);
export const SAMPLE_FOLLOW_UP_SOMETHING_ELSE = "Something else";

export const SAMPLE_LATEST_CHANGE =
  '"Timing the conversation" is your current attention. Your Priority is still "Understand what I need".';

export const SAMPLE_COMPASS: ScreenCompass = freeze({
  points: freeze([
    freeze({ id: "understand-need", label: "Understand what I need", labelLines: ["Understand", "what I need"], category: "Priority", zone: "priority", forming: false }),
    freeze({ id: "avoiding-conflict", label: "Avoiding conflict", labelLines: ["Avoiding", "conflict"], category: "Detour", zone: "detourLeft", forming: false }),
    freeze({ id: "timing", label: "Timing the conversation", labelLines: ["Timing the", "conversation"], category: "Detour", zone: "detourRight", forming: false }),
    freeze({ id: "afterward", label: "What happens afterward", labelLines: ["What happens", "afterward"], category: "Excursion", zone: "excursion", forming: true }),
  ] as ScreenCompassPoint[]),
  priorityId: "understand-need",
  attentionId: "timing",
  otherPathsCount: 1,
  compact: freeze({
    current: "Timing the conversation",
    previous: "Understand what I need",
    earlier: "Avoiding conflict",
    moreCount: 1,
  }),
});

export const SAMPLE_WAYPOINT: ScreenWaypoint = freeze({
  name: "Name what I need before talking",
  whereAndWhy: "Before the difficult conversation, so I can explain myself without rushing.",
  reachedLooksLike: "I can say the one need I most want understood.",
  status: "Forming",
  quotes: freeze([
    "I mostly want to understand what I need before I talk to them.",
    "I also want to identify the one thing I most need them to understand.",
  ]),
  replacedQuotes: freeze(["I don't know how to explain what I need."]),
  shareLine: `Private. Not shared with ${SAMPLE_GUIDE_NAME}.`,
});

export const SAMPLE_KEY_INSIGHT = "Clarity needs to come before finding the right words.";
export const SAMPLE_NEXT_DIRECTION = "Decide when to have the conversation";

export const SAMPLE_GUIDE_BANNER = freeze({
  title: `${SAMPLE_GUIDE_LABEL}, is part of your journey.`,
  body: `${SAMPLE_GUIDE_NAME} is not in this conversation and is not reading it. Conversations with ${SAMPLE_GUIDE_NAME} happen in a separate space.`,
  button: `Conversations with ${SAMPLE_GUIDE_NAME}`,
});

// Everything the screen shows, gathered for the preview composition boundary.
export const SAMPLE_CONVERSATION_SCREEN: ConversationScreenData = freeze({
  shell: freeze({
    navigation: SAMPLE_NAVIGATION,
    conversationSpaces: SAMPLE_CONVERSATION_SPACES,
    profile: SAMPLE_PROFILE,
    guideBanner: SAMPLE_GUIDE_BANNER,
    guideName: SAMPLE_GUIDE_NAME,
  }),
  header: SAMPLE_HEADER,
  transcript: freeze({
    turns: SAMPLE_TURNS,
    speakerLabels: SAMPLE_SPEAKER_LABELS,
    openingChoices: SAMPLE_OPENING_CHOICES,
    followUpChoices: SAMPLE_FOLLOW_UP_CHOICES,
    followUpSomethingElse: SAMPLE_FOLLOW_UP_SOMETHING_ELSE,
  }),
  latestChange: SAMPLE_LATEST_CHANGE,
  support: freeze({
    compass: SAMPLE_COMPASS,
    waypoint: SAMPLE_WAYPOINT,
    guideName: SAMPLE_GUIDE_NAME,
    explorerSpeakerLabel: SAMPLE_SPEAKER_LABELS.explorer,
    keyInsight: SAMPLE_KEY_INSIGHT,
    nextDirection: SAMPLE_NEXT_DIRECTION,
  }),
});
