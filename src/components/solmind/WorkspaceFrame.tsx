"use client";

import { useState, type ReactNode } from "react";

import type { WorkspaceFrameData } from "@/lib/solmind/explorerConversationScreenDisplay";

import { MenuPanel, type MenuData } from "./ExplorerConversationScreenNavigation";
import { FOCUS_RING, NotConnectedProvider, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";
import { AmbientGlow, Rail, UtilityBar } from "./ExplorerConversationScreenShell";

// The signed-in workspace frame (Paul's 2026-11-02 decisions, decision queue
// 14:07:48 and 22:19:17 CST): the same dark and amber page as the signed-in
// conversation screen, reusing its parts - the ambient glow, the wide-screen
// rail with the September 23 menu, the top bar (the Menu button first on
// phones, the small phone logo, a plain-text breadcrumb on wide screens, and
// the bell and profile that explain themselves) and the phone menu panel -
// around one <main> for the page.
//
// Presentation only, and role-neutral: the menu entries, names, breadcrumb
// root and profile role come in as data (explorerWorkspaceFrame.ts for the
// Explorer, guideWorkspaceFrame.ts for the Guide). The frame owns layout
// state only: whether the phone menu is open and which "Not connected yet"
// sentence is shown. While a sign-out is pending (linksDisabled) every menu
// link shows in its non-link form. The conversation screen keeps its own
// shell (ExplorerConversationScreenShell.tsx).

export const WORKSPACE_MAIN_ID = "workspace-main";

type WorkspaceFrameProps = Readonly<{
  frame: WorkspaceFrameData;
  // The element the skip control and the page's own menu entry focus: the
  // page heading when it can take focus, otherwise <main>.
  skipTargetId?: string;
  linksDisabled?: boolean;
  children: ReactNode;
}>;

// The breadcrumb page is the page's own name when no menu entry stands for
// it (breadcrumbPage), otherwise the current menu entry's label.
function Breadcrumb({ frame }: Readonly<{ frame: WorkspaceFrameData }>) {
  const current = frame.navigation.find((item) => item.current !== false);

  return (
    <p className="hidden text-sm text-stone-400 lg:block">
      {`${frame.breadcrumbRoot} `}
      <span aria-hidden="true">/</span>{" "}
      <span className="text-stone-200">{frame.breadcrumbPage ?? current?.label ?? ""}</span>
    </p>
  );
}

export function WorkspaceFrame({ frame, skipTargetId = WORKSPACE_MAIN_ID, linksDisabled = false, children }: WorkspaceFrameProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openExplanation, setOpenExplanation] = useState<string | null>(null);
  const toggleExplanation = (id: string) => setOpenExplanation((open) => (open === id ? null : id));
  const menu: MenuData = {
    labels: frame.labels,
    navigation: frame.navigation,
    spaces: frame.spaces,
    guideName: frame.guideName,
    pageHeadingId: skipTargetId,
    linksDisabled,
  };

  return (
    <NotConnectedProvider onToggle={toggleExplanation} openId={openExplanation}>
      <div className="relative isolate flex min-h-dvh w-full flex-col bg-[#050404] text-stone-100">
        <AmbientGlow />
        <button
          className={joinClasses(
            "sr-only rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50",
            FOCUS_RING,
          )}
          onClick={() => document.getElementById(skipTargetId)?.focus()}
          type="button"
        >
          Skip to the main content
        </button>
        <div className="flex w-full flex-1">
          <Rail {...menu} onMenuOpenChange={setMenuOpen} />
          <div className="relative flex min-w-0 flex-1 flex-col">
            <UtilityBar
              breadcrumb={<Breadcrumb frame={frame} />}
              connected
              menuOpen={menuOpen}
              onMenuOpenChange={setMenuOpen}
              profile={frame.profile}
            />
            <MenuPanel {...menu} menuOpen={menuOpen} onMenuOpenChange={setMenuOpen} />
            <main className="flex min-w-0 flex-1 flex-col focus:outline-none" id={WORKSPACE_MAIN_ID} tabIndex={-1}>
              {children}
            </main>
          </div>
        </div>
      </div>
    </NotConnectedProvider>
  );
}
