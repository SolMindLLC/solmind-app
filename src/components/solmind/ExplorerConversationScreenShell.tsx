import Image from "next/image";
import type { ReactNode } from "react";

import { SOLMIND_LOGO_SRC } from "@/lib/solmind/explorerCompassComparison";
import { LAYOUT_ONLY_LABEL, VIRTUAL_GUIDE_SHORT } from "@/lib/solmind/explorerConversationScreen";
import type { ScreenGuideBanner, ScreenProfile, ScreenShellData } from "@/lib/solmind/explorerConversationScreenDisplay";
import { EXPLORER_MENU_LABELS } from "@/lib/solmind/workspaceNavigation";

import { BuildNotesToggle } from "./ExplorerConversationScreenBuildNotes";
import { IconBell, IconBoot, IconUsers, PROFILE_ICONS } from "./ExplorerConversationScreenIcons";
import { MenuButton, MenuPanel, RailNavigation, type MenuData } from "./ExplorerConversationScreenNavigation";
import {
  FOCUS_RING, NotConnectedButton, NotConnectedLine, NotYetImplementedNote, PreviewBand, QUIET_BUTTON, SampleTag, UnwiredButton,
  UnwiredControl, joinClasses, noteId,
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

export function AmbientGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_0%,_rgba(245,158,11,0.12),_transparent_38%),radial-gradient(circle_at_6%_94%,_rgba(234,88,12,0.14),_transparent_28%),radial-gradient(circle_at_96%_40%,_rgba(180,83,9,0.07),_transparent_30%),linear-gradient(180deg,_#080605,_#030303)]"
    />
  );
}

// The conversation screens' menu data, with the Explorer menu names.
function shellMenu(shell: ScreenShellData): MenuData {
  return { labels: EXPLORER_MENU_LABELS, navigation: shell.navigation, spaces: shell.conversationSpaces, guideName: shell.guideName };
}

// The wide-screen rail: the logo and the workspace menu (also used by
// WorkspaceFrame.tsx).
export function Rail({ onMenuOpenChange, ...menu }: MenuData & Readonly<{ onMenuOpenChange: (open: boolean) => void }>) {
  return (
    <aside
      aria-label="SolMind workspace"
      className="relative hidden w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-amber-200/10 bg-black pb-6 lg:flex"
    >
      <div className="px-6 pt-7">
        <SolMindLogo className="w-44" />
      </div>
      <RailNavigation {...menu} onMenuOpenChange={onMenuOpenChange} />
    </aside>
  );
}

// breadcrumb replaces the signed-in conversation screen's plain-text
// breadcrumb (WorkspaceFrame.tsx passes its own).
type UtilityBarProps = Readonly<{
  profile: ScreenProfile;
  connected: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  breadcrumb?: ReactNode;
}>;

// Overview in the menu is the way home, as on September 23, so the top bar
// has no separate home link.
export function UtilityBar({ profile, connected, menuOpen, onMenuOpenChange, breadcrumb }: UtilityBarProps) {
  const profileLabel = profile.name ? `${profile.name}, ${profile.role} profile` : `${profile.role} profile`;
  const profileClass = joinClasses(
    "flex items-center gap-2 rounded-full border border-amber-200/20 py-1 pl-1 pr-3 text-left hover:bg-amber-300/10",
    FOCUS_RING,
  );
  // The hiking boot unless the profile names another icon (the Guide's).
  const ProfileIcon = (profile.icon === undefined ? undefined : PROFILE_ICONS[profile.icon]) ?? IconBoot;
  const avatar = (
    <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full border border-amber-300/60 bg-amber-300/10 text-amber-100">
      <ProfileIcon />
    </span>
  );

  return (
    <div className="border-b border-amber-200/10 bg-black/70">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-6 lg:px-8">
        <MenuButton connected={connected} menuOpen={menuOpen} onMenuOpenChange={onMenuOpenChange} />
        <SolMindLogo className="w-20 lg:hidden" />
        {breadcrumb !== undefined ? (
          breadcrumb
        ) : connected ? (
          <p className="hidden text-sm text-stone-400 lg:block">
            Conversations <span aria-hidden="true">/</span>{" "}
            <span className="text-stone-200">With your {VIRTUAL_GUIDE_SHORT}</span>
          </p>
        ) : (
          <p className="hidden items-center gap-1 text-sm text-stone-400 lg:flex">
            <UnwiredButton className={joinClasses("rounded-md px-1 text-stone-300 hover:text-stone-100", FOCUS_RING)} noteId={noteId("top", "breadcrumb")}>
              Conversations
            </UnwiredButton>
            <span aria-hidden="true">/</span>
            <span className="text-stone-200">With your {VIRTUAL_GUIDE_SHORT}</span>
          </p>
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {/* The page's build-note toggle, only where the screen places BuildNotesProvider. */}
          <BuildNotesToggle />
          {connected ? (
            // Like the menu entries, the bell shows the blue build-note label
            // beside its icon, with "Notifications" for screen readers:
            // "Notifications Not connected yet". It stays no taller than the
            // profile chip.
            <NotConnectedButton
              className={joinClasses(
                "flex h-10 items-center gap-2 rounded-full border border-amber-200/20 pl-2.5 pr-3 text-amber-200 hover:bg-amber-300/10",
                FOCUS_RING,
              )}
              explanationId={noteId("top", "notifications")}
            >
              <IconBell className="h-5 w-5" />
              <span className="sr-only">Notifications </span>
              <NotConnectedLine />
            </NotConnectedButton>
          ) : (
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
          )}
          {connected ? (
            // As on September 23, the visible role and label are the name,
            // with "profile" for screen readers: "Explorer profile Not connected yet".
            <NotConnectedButton className={profileClass} explanationId={noteId("top", "profile")}>
              {avatar}
              <span className="flex flex-col leading-tight">
                {profile.name ? <span className="text-sm font-medium text-stone-100">{profile.name}</span> : null}
                <span className={profile.name ? "text-[11px] text-stone-400" : "text-sm font-medium text-stone-100"}>
                  {profile.role}
                  <span className="sr-only"> profile</span>
                </span>
                <NotConnectedLine />
              </span>
            </NotConnectedButton>
          ) : (
            <UnwiredButton className={profileClass} label={profileLabel} noteId={noteId("top", "profile")}>
              {avatar}
              <span className="flex flex-col leading-tight">
                {profile.name ? <span className="text-sm font-medium text-stone-100">{profile.name}</span> : null}
                <span className={profile.name ? "text-[11px] text-stone-400" : "text-sm font-medium text-stone-100"}>{profile.role}</span>
                <NotConnectedLine />
              </span>
            </UnwiredButton>
          )}
          {connected ? null : <SampleTag />}
        </div>
      </header>
      {connected ? (
        // Each sentence shows here only while its control is open.
        <div className="flex flex-wrap justify-end gap-2 px-3 sm:px-6 lg:px-8">
          <NotYetImplementedNote className="pb-2.5" id={noteId("top", "notifications")} noteKey="notifications" />
          <NotYetImplementedNote className="pb-2.5" id={noteId("top", "profile")} noteKey="profile" />
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2 px-3 pb-2.5 sm:px-6 lg:px-8">
          <NotYetImplementedNote className="hidden lg:block" id={noteId("top", "breadcrumb")} noteKey="breadcrumb" />
          <NotYetImplementedNote id={noteId("top", "notifications")} noteKey="notifications" />
          <NotYetImplementedNote id={noteId("top", "profile")} noteKey="profile" />
        </div>
      )}
    </div>
  );
}

type GuideBannerProps = Readonly<{ banner: ScreenGuideBanner; guideName: string; connected: boolean }>;

function GuideBanner({ banner, guideName, connected }: GuideBannerProps) {
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
              {connected ? null : <SampleTag />}
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

// menuOpen is the phone Menu's layout state, owned by the client boundary.
type ShellProps = Readonly<{
  shell: ScreenShellData;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onSkip: () => void;
  children: ReactNode;
  drawer: ReactNode;
  // The connected /explorer/conversation screen shows real saved data: it has
  // no preview band or "Sample" tags, and its breadcrumb is plain text.
  connected?: boolean;
}>;

export function ExplorerConversationScreenShell({
  shell,
  menuOpen,
  onMenuOpenChange,
  onSkip,
  children,
  drawer,
  connected = false,
}: ShellProps) {
  return (
    <div className="relative isolate flex min-h-dvh w-full flex-col bg-[#050404] text-stone-100">
      <AmbientGlow />
      <button
        className={joinClasses(
          "sr-only rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50",
          FOCUS_RING,
        )}
        data-preview-control={connected ? undefined : "layout"}
        onClick={onSkip}
        type="button"
      >
        {connected ? (
          "Skip to the conversation"
        ) : (
          <>
            Skip to the conversation <span className="font-normal">({LAYOUT_ONLY_LABEL})</span>
          </>
        )}
      </button>
      {connected ? null : <PreviewBand />}
      <div className="flex w-full flex-1">
        <Rail {...shellMenu(shell)} onMenuOpenChange={onMenuOpenChange} />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <UtilityBar connected={connected} menuOpen={menuOpen} onMenuOpenChange={onMenuOpenChange} profile={shell.profile} />
          <MenuPanel {...shellMenu(shell)} menuOpen={menuOpen} onMenuOpenChange={onMenuOpenChange} />
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          <GuideBanner banner={shell.guideBanner} connected={connected} guideName={shell.guideName} />
        </div>
      </div>
      {drawer}
    </div>
  );
}
