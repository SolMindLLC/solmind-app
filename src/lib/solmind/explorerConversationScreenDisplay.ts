// Read-only display data for the interim /explorer/conversation-preview design
// review. The presentation parts take these shapes as props and never import
// the sample content; only the preview composition boundary
// (ExplorerConversationScreenPreview.tsx) supplies the written sample. A
// connected screen could later supply the same shapes instead.

import type { NotYetImplementedKey } from "./explorerConversationScreen";

// Where a menu entry leads. The review version's entries are unwired and name
// their "Not yet implemented:" note. The signed-in screens' entries come from
// workspaceMenus.ts (mapped in explorerConversationConnectedScreen.ts,
// explorerWorkspaceFrame.ts and guideWorkspaceFrame.ts): a
// working destination, or none yet (href null) with the sentence that says
// what the entry will do.
export type ScreenEntryTarget =
  | Readonly<{ noteKey: NotYetImplementedKey }>
  | Readonly<{ href: string }>
  | Readonly<{ href: null; explanation: string }>;

// id names the entry and picks its icon (MENU_ICONS in
// ExplorerConversationScreenIcons.tsx), so a workspace menu for another role
// can reuse the same list. current marks this page's section (true, as
// Conversations on the conversation screens) or an entry that is this page
// itself ("page", as Overview on the Explorer home).
export type ScreenNavigationItem = Readonly<{
  id: string;
  label: string;
  current: boolean | "page";
}> &
  ScreenEntryTarget;

// The entries under Conversations. current marks this screen's own space;
// description is the second line under the label (none when null).
export type ScreenConversationSpace = Readonly<{
  id: "virtualGuide" | "guide" | "newConversation";
  label: string;
  description: string | null;
  current: boolean;
}> &
  ScreenEntryTarget;

// icon picks the profile chip's icon by id (PROFILE_ICONS in
// ExplorerConversationScreenIcons.tsx); without one the chip shows the
// Explorer's hiking boot, as on the conversation screens.
export type ScreenProfile = Readonly<{ name: string; role: string; icon?: string }>;

// The names a workspace menu shows: the rail's and the phone panel's
// navigation names, the list heading and the name of the list of conversation
// spaces.
export type WorkspaceMenuLabels = Readonly<{ rail: string; phone: string; heading: string; spaces: string }>;

// One signed-in workspace page's frame (WorkspaceFrame.tsx): its menu with the
// page's section current, the entries shown under that section (none when
// empty), the breadcrumb root and the profile chip. guideName is unused by
// signed-in entries and kept only for the shared menu's review notes.
// breadcrumbPage names a page that no menu entry stands for (the Guide's
// Waypoint Suggestions pages); otherwise the breadcrumb shows the current
// entry's label.
export type WorkspaceFrameData = Readonly<{
  labels: WorkspaceMenuLabels;
  breadcrumbRoot: string;
  breadcrumbPage?: string;
  navigation: readonly ScreenNavigationItem[];
  spaces: readonly ScreenConversationSpace[];
  profile: ScreenProfile;
  guideName: string;
}>;

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
