import { VIRTUAL_GUIDE_SHORT, aiDisclosure } from "@/lib/solmind/explorerConversationScreen";
import type { ScreenHeader } from "@/lib/solmind/explorerConversationScreenDisplay";
import type { SpeakerLabelStyle } from "@/lib/solmind/explorerSpeakerStyle";

import { IconEye, IconEyeOff, IconPanelRight } from "./ExplorerConversationScreenIcons";
import {
  FOCUS_RING,
  LayoutOnlyTag,
  NotYetImplementedNote,
  QUIET_BUTTON,
  SampleTag,
  SECONDARY_BUTTON,
  UnwiredButton,
  UnwiredControl,
  joinClasses,
  noteId,
} from "./ExplorerConversationScreenNotYetImplemented";
import { SpeakerBadge } from "./ExplorerConversationScreenSpeaker";

export const CONVERSATION_HEADING_ID = "conversation-preview-heading";
export const PANEL_TOGGLE_ID = "conversation-preview-panel-toggle";
export const DRAWER_OPENER_ID = "conversation-preview-drawer-opener";

type VirtualGuideRowProps = Readonly<{
  virtualGuideName: string;
  virtualGuidePrimaryLabel: string;
  speakerStyle: SpeakerLabelStyle;
  panelVisible: boolean;
  drawerOpen: boolean;
  panelId: string;
  drawerId: string;
  onTogglePanel: () => void;
  onOpenDrawer: () => void;
}>;

// Virtual Guide name, AI disclosure, Rename and the two panel controls. Wide
// screens show the Show/Hide toggle; narrow screens show the drawer opener.
export function VirtualGuideRow({
  virtualGuideName,
  virtualGuidePrimaryLabel,
  speakerStyle,
  panelVisible,
  drawerOpen,
  panelId,
  drawerId,
  onTogglePanel,
  onOpenDrawer,
}: VirtualGuideRowProps) {
  const renameNote = noteId("header", "rename");

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-3 pt-4 sm:px-6 lg:px-8 lg:pt-5">
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SpeakerBadge size="large" speaker="virtualGuide" speakerStyle={speakerStyle} />
          <p className="font-serif text-lg text-stone-50 sm:text-xl">{virtualGuidePrimaryLabel}</p>
          <span className="rounded-full border border-amber-300/50 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
            AI
          </span>
          <UnwiredButton className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")} noteId={renameNote}>
            Rename
          </UnwiredButton>
        </div>
        <p className="text-xs leading-5 text-stone-300">{aiDisclosure(virtualGuideName)}</p>
        <NotYetImplementedNote className="max-w-md" id={renameNote} noteKey="rename" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-controls={panelId}
          aria-expanded={panelVisible}
          className={joinClasses(SECONDARY_BUTTON, "max-lg:hidden")}
          data-preview-control="layout"
          id={PANEL_TOGGLE_ID}
          onClick={onTogglePanel}
          type="button"
        >
          <IconPanelRight />
          {panelVisible ? "Hide Compass & Waypoint" : "Show Compass & Waypoint"}
        </button>
        <button
          aria-controls={drawerId}
          aria-expanded={drawerOpen}
          aria-haspopup="dialog"
          className={joinClasses(SECONDARY_BUTTON, "lg:hidden")}
          data-preview-control="layout"
          id={DRAWER_OPENER_ID}
          onClick={onOpenDrawer}
          type="button"
        >
          <IconPanelRight />
          Show Compass &amp; Waypoint
        </button>
        <LayoutOnlyTag />
      </div>
    </div>
  );
}

// Label, title, privacy pill, status and the sharing controls.
export function ConversationHeader({ header }: Readonly<{ header: ScreenHeader }>) {
  return (
    <header className="border-b border-amber-200/10 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">{header.label}</p>
        <SampleTag />
      </div>
      <h1
        className={joinClasses("mt-1 rounded-md font-serif text-2xl leading-tight text-stone-50 sm:text-3xl", FOCUS_RING)}
        id={CONVERSATION_HEADING_ID}
        tabIndex={-1}
      >
        {header.title}
      </h1>
      <p className="mt-1 text-sm text-stone-400">{header.startedFrom}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-600 bg-black/30 px-3 py-1 text-xs font-semibold text-stone-200">
          <IconEyeOff className="h-3.5 w-3.5" />
          Private conversation
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-stone-300">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />
          {header.status}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <UnwiredControl
          className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")}
          guideName={header.guideName}
          noteKey="shareConversation"
          scope="header"
        >
          <IconEye />
          Share whole conversation
        </UnwiredControl>
        <UnwiredControl
          className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")}
          noteKey="virtualGuideCanSee"
          scope="header"
        >
          <IconEye />
          What the {VIRTUAL_GUIDE_SHORT} can see
        </UnwiredControl>
      </div>
    </header>
  );
}
