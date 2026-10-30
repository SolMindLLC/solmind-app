import Image from "next/image";
import type { ReactNode } from "react";

import { SOLMIND_LOGO_SRC } from "@/lib/solmind/explorerCompassComparison";
import { LAYOUT_ONLY_LABEL, VIRTUAL_GUIDE_SHORT } from "@/lib/solmind/explorerConversationScreen";
import type { ScreenGuideBanner, ScreenProfile, ScreenShellData } from "@/lib/solmind/explorerConversationScreenDisplay";

import { IconBell, IconBoot, IconUsers } from "./ExplorerConversationScreenIcons";
import { NarrowNavigation, RailNavigation } from "./ExplorerConversationScreenNavigation";
import {
  FOCUS_RING, NotYetImplementedNote, PreviewBand, QUIET_BUTTON, SampleTag, UnwiredButton, UnwiredControl, joinClasses,
  noteId,
} from "./ExplorerConversationScreenNotYetImplemented";

// The exact supplied dark logo asset, served unchanged from /public.
export function SolMindLogo({ className }: Readonly<{ className?: string }>) {
  return (
    <Image
      alt="SolMind: Illuminate, Understand, Grow"
      className={joinClasses("h-auto", className)}
      height={520}
      loading="eager"
      src={SOLMIND_LOGO_SRC}
      unoptimized
      width={720}
    />
  );
}

function AmbientGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_0%,_rgba(245,158,11,0.12),_transparent_38%),radial-gradient(circle_at_6%_94%,_rgba(234,88,12,0.14),_transparent_28%),radial-gradient(circle_at_96%_40%,_rgba(180,83,9,0.07),_transparent_30%),linear-gradient(180deg,_#080605,_#030303)]"
    />
  );
}

function Rail({ shell }: Readonly<{ shell: ScreenShellData }>) {
  return (
    <aside
      aria-label="SolMind workspace"
      className="relative hidden w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-amber-200/10 bg-black pb-6 lg:flex"
    >
      <div className="px-6 pt-7">
        <SolMindLogo className="w-44" />
      </div>
      <RailNavigation guideName={shell.guideName} navigation={shell.navigation} spaces={shell.conversationSpaces} />
    </aside>
  );
}

function UtilityBar({ profile }: Readonly<{ profile: ScreenProfile }>) {
  return (
    <div className="border-b border-amber-200/10 bg-black/70">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-6 lg:px-8">
        <SolMindLogo className="w-20 lg:hidden" />
        <p className="hidden items-center gap-1 text-sm text-stone-400 lg:flex">
          <UnwiredButton className={joinClasses("rounded-md px-1 text-stone-300 hover:text-stone-100", FOCUS_RING)} noteId={noteId("top", "breadcrumb")}>
            Conversations
          </UnwiredButton>
          <span aria-hidden="true">/</span>
          <span className="text-stone-200">With your {VIRTUAL_GUIDE_SHORT}</span>
        </p>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <UnwiredButton
            className={joinClasses(
              "grid h-10 w-10 place-items-center rounded-full border border-amber-200/20 text-amber-200 hover:bg-amber-300/10",
              FOCUS_RING,
            )}
            label="Notifications"
            noteId={noteId("top", "notifications")}
          >
            <IconBell className="h-5 w-5" />
          </UnwiredButton>
          <UnwiredButton
            className={joinClasses(
              "flex items-center gap-2 rounded-full border border-amber-200/20 py-1 pl-1 pr-3 text-left hover:bg-amber-300/10",
              FOCUS_RING,
            )}
            label={`${profile.name}, ${profile.role} profile`}
            noteId={noteId("top", "profile")}
          >
            <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full border border-amber-300/60 bg-amber-300/10 text-amber-100">
              <IconBoot />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-medium text-stone-100">{profile.name}</span>
              <span className="text-[11px] text-stone-400">{profile.role}</span>
            </span>
          </UnwiredButton>
          <SampleTag />
        </div>
      </header>
      <div className="flex flex-wrap justify-end gap-2 px-3 pb-2.5 sm:px-6 lg:px-8">
        <NotYetImplementedNote className="hidden lg:block" id={noteId("top", "breadcrumb")} noteKey="breadcrumb" />
        <NotYetImplementedNote id={noteId("top", "notifications")} noteKey="notifications" />
        <NotYetImplementedNote id={noteId("top", "profile")} noteKey="profile" />
      </div>
    </div>
  );
}

function GuideBanner({ banner, guideName }: Readonly<{ banner: ScreenGuideBanner; guideName: string }>) {
  return (
    <aside
      aria-labelledby="conversation-preview-guide-banner"
      className="shrink-0 border-t border-amber-200/10 bg-black/70 px-4 py-3 sm:px-6 lg:px-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-300/40 text-amber-300">
            <IconUsers className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-stone-100" id="conversation-preview-guide-banner">
                {banner.title}
              </p>
              <SampleTag />
            </div>
            <p className="text-xs leading-5 text-stone-400">{banner.body}</p>
          </div>
        </div>
        <UnwiredControl
          className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")}
          guideName={guideName}
          noteKey="guideSpace"
          scope="banner"
          wrapperClassName="max-w-xs"
        >
          {banner.button}
        </UnwiredControl>
      </div>
    </aside>
  );
}

type ShellProps = Readonly<{
  shell: ScreenShellData;
  spacesOpen: boolean;
  onToggleSpaces: () => void;
  onSkip: () => void;
  children: ReactNode;
  drawer: ReactNode;
}>;

export function ExplorerConversationScreenShell({ shell, spacesOpen, onToggleSpaces, onSkip, children, drawer }: ShellProps) {
  return (
    <div className="relative isolate flex min-h-dvh w-full flex-col bg-[#050404] text-stone-100">
      <AmbientGlow />
      <button
        className={joinClasses(
          "sr-only rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50",
          FOCUS_RING,
        )}
        data-preview-control="layout"
        onClick={onSkip}
        type="button"
      >
        Skip to the conversation <span className="font-normal">({LAYOUT_ONLY_LABEL})</span>
      </button>
      <PreviewBand />
      <div className="flex w-full flex-1">
        <Rail shell={shell} />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <UtilityBar profile={shell.profile} />
          <NarrowNavigation
            guideName={shell.guideName}
            navigation={shell.navigation}
            onToggleSpaces={onToggleSpaces}
            spaces={shell.conversationSpaces}
            spacesOpen={spacesOpen}
          />
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          <GuideBanner banner={shell.guideBanner} guideName={shell.guideName} />
        </div>
      </div>
      {drawer}
    </div>
  );
}
