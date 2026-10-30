// Read-only display data for the interim /explorer/conversation-preview design
// review. The presentation parts take these shapes as props and never import
// the sample content; only the preview composition boundary
// (ExplorerConversationScreenPreview.tsx) supplies the written sample. A
// connected screen could later supply the same shapes instead.

import type { NotYetImplementedKey } from "./explorerConversationScreen";

export type ScreenNavigationItem = Readonly<{
  id: "overview" | "conversations" | "waypoints" | "settings";
  label: string;
  shortLabel: string;
  noteKey: NotYetImplementedKey;
  current: boolean;
}>;

export type ScreenConversationSpace = Readonly<{
  id: "virtualGuide" | "guide";
  label: string;
  description: string;
  noteKey: NotYetImplementedKey;
  current: boolean;
}>;

export type ScreenProfile = Readonly<{ name: string; role: string }>;

export type ScreenGuideBanner = Readonly<{ title: string; body: string; button: string }>;

// guideName (here, in the header and in the support data) is the Guide name
// the "Not yet implemented:" notes for those parts show.
export type ScreenShellData = Readonly<{
  navigation: readonly ScreenNavigationItem[];
  conversationSpaces: readonly ScreenConversationSpace[];
  profile: ScreenProfile;
  guideBanner: ScreenGuideBanner;
  guideName: string;
}>;

export type ScreenHeader = Readonly<{
  label: string;
  title: string;
  startedFrom: string;
  status: string;
  guideName: string;
  virtualGuideName: string;
  virtualGuidePrimaryLabel: string;
}>;

export type ScreenSpeaker = "virtualGuide" | "explorer";

export type ScreenTurn = Readonly<{
  id: string;
  speaker: ScreenSpeaker;
  body: string;
  extra: "openingChoices" | "check" | null;
}>;

export type ScreenChoice = Readonly<{ id: string; label: string; tag: string | null }>;

export type ScreenTranscriptData = Readonly<{
  turns: readonly ScreenTurn[];
  speakerLabels: Readonly<Record<ScreenSpeaker, string>>;
  openingChoices: Readonly<{
    continueOrRevisit: readonly ScreenChoice[];
    startNew: readonly ScreenChoice[];
    somethingElse: string;
  }>;
  followUpChoices: readonly ScreenChoice[];
  followUpSomethingElse: string;
}>;

// Fixed Priority-up frame, as in the accepted S01R2 Compass: Priority at the
// top, a Detour on each side and the Excursion below. It never rotates.
export type ScreenCompassZone = "priority" | "detourLeft" | "detourRight" | "excursion";

export type ScreenCompassPoint = Readonly<{
  id: string;
  label: string;
  labelLines: readonly [string, string];
  category: "Priority" | "Detour" | "Excursion";
  zone: ScreenCompassZone;
  forming: boolean;
}>;

export type ScreenCompass = Readonly<{
  points: readonly ScreenCompassPoint[];
  priorityId: string;
  attentionId: string;
  otherPathsCount: number;
  compact: Readonly<{ current: string; previous: string; earlier: string; moreCount: number }>;
}>;

export type ScreenWaypoint = Readonly<{
  name: string;
  whereAndWhy: string;
  reachedLooksLike: string;
  status: string;
  quotes: readonly string[];
  replacedQuotes: readonly string[];
  shareLine: string;
}>;

export type ScreenSupportData = Readonly<{
  compass: ScreenCompass;
  waypoint: ScreenWaypoint;
  guideName: string;
  explorerSpeakerLabel: string;
  keyInsight: string;
  nextDirection: string;
}>;

export type ConversationScreenData = Readonly<{
  shell: ScreenShellData;
  header: ScreenHeader;
  transcript: ScreenTranscriptData;
  latestChange: string;
  support: ScreenSupportData;
}>;
