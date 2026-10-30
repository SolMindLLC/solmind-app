"use client";

import { useState } from "react";

import type { ConversationScreenData } from "@/lib/solmind/explorerConversationScreenDisplay";
import { SAMPLE_CONVERSATION_SCREEN } from "@/lib/solmind/explorerConversationScreenSample";
import { SPEAKER_LABEL_STYLE, type SpeakerLabelStyle } from "@/lib/solmind/explorerSpeakerStyle";

import { ConversationComposer } from "./ExplorerConversationScreenComposer";
import type { CompassView } from "./ExplorerConversationScreenCompassPanel";
import { CONVERSATION_HEADING_ID, ConversationHeader, VirtualGuideRow } from "./ExplorerConversationScreenHeader";
import { ExplorerConversationScreenShell } from "./ExplorerConversationScreenShell";
import { SpeakerStyleSwitch } from "./ExplorerConversationScreenSpeaker";
import {
  SUPPORT_DRAWER_ID,
  SUPPORT_PANEL_ID,
  SupportDrawer,
  SupportPanel,
} from "./ExplorerConversationScreenSupportPanel";
import { ConversationTranscript } from "./ExplorerConversationScreenTranscript";

// Interim design review of the Explorer conversation screen.
//
// This is the composition boundary: the only place that imports the written
// sample content, which it passes to the presentation parts as read-only
// props. A connected screen could supply the same display shapes instead.
//
// It owns only layout state: whether the wide panel shows, whether the narrow
// drawer is open, whether the narrow conversation spaces show, the Compass
// view, whether the supporting quotes list is open and which speaker label
// style is shown for comparison. That state lives in component memory only.
// Nothing is requested, stored, sent or shared; every other control explains,
// beside itself, what it will do.
export function ExplorerConversationScreenPreview() {
  const data: ConversationScreenData = SAMPLE_CONVERSATION_SCREEN;
  const [panelVisible, setPanelVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [spacesOpen, setSpacesOpen] = useState(false);
  const [compassView, setCompassView] = useState<CompassView>("full");
  const [quotesOpen, setQuotesOpen] = useState(false);
  const [speakerStyle, setSpeakerStyle] = useState<SpeakerLabelStyle>(SPEAKER_LABEL_STYLE);

  const layout = {
    support: data.support,
    compassView,
    onToggleCompassView: () => setCompassView((view) => (view === "full" ? "compact" : "full")),
    quotesOpen,
    onQuotesToggle: setQuotesOpen,
  };

  function skipToConversation() {
    document.getElementById(CONVERSATION_HEADING_ID)?.focus();
  }

  return (
    <ExplorerConversationScreenShell
      drawer={<SupportDrawer {...layout} onClose={() => setDrawerOpen(false)} open={drawerOpen} />}
      onSkip={skipToConversation}
      onToggleSpaces={() => setSpacesOpen((open) => !open)}
      shell={data.shell}
      spacesOpen={spacesOpen}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <VirtualGuideRow
          drawerId={SUPPORT_DRAWER_ID}
          drawerOpen={drawerOpen}
          onOpenDrawer={() => setDrawerOpen(true)}
          onTogglePanel={() => setPanelVisible((visible) => !visible)}
          panelId={SUPPORT_PANEL_ID}
          panelVisible={panelVisible}
          speakerStyle={speakerStyle}
          virtualGuideName={data.header.virtualGuideName}
          virtualGuidePrimaryLabel={data.header.virtualGuidePrimaryLabel}
        />
        <div className="flex min-h-0 flex-1 items-start gap-5 px-3 pb-6 pt-4 sm:px-6 lg:px-8">
          <section
            aria-labelledby={CONVERSATION_HEADING_ID}
            className="flex min-w-0 flex-1 flex-col rounded-3xl border border-amber-200/15 bg-[#0c0a08]/90 shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
          >
            <ConversationHeader header={data.header} />
            <div className="border-b border-amber-200/10 px-4 py-2 sm:px-5">
              <SpeakerStyleSwitch onChange={setSpeakerStyle} speakerStyle={speakerStyle} />
            </div>
            <ConversationTranscript speakerStyle={speakerStyle} transcript={data.transcript} />
            <ConversationComposer latestChange={data.latestChange} />
          </section>
          <SupportPanel {...layout} visible={panelVisible} />
        </div>
      </div>
    </ExplorerConversationScreenShell>
  );
}
