import type { KeyboardEvent, MouseEvent } from "react";

import type { ScreenConversationSpace, ScreenNavigationItem } from "@/lib/solmind/explorerConversationScreenDisplay";
import { EXPLORER_MENU_LABELS } from "@/lib/solmind/workspaceNavigation";

import { CONVERSATION_HEADING_ID } from "./ExplorerConversationScreenHeader";
import { IconChat, IconClose, IconGear, IconMapPin, IconMenu, IconOverview } from "./ExplorerConversationScreenIcons";
import {
  FOCUS_RING, LayoutOnlyTag, NotConnectedButton, NotConnectedExplanation, NotConnectedLine, NotYetImplementedNote,
  UnwiredButton, joinClasses, noteId,
} from "./ExplorerConversationScreenNotYetImplemented";

// The Explorer workspace menu: the September 23 list Paul accepted (his
// 2026-11-02 option A), in the wide-screen rail and, below 64rem, in the panel
// the top bar's Menu button opens. The class strings are copied from
// ExplorerCompassComparisonParts.tsx.
//
// Review version: every entry is unwired and its "Not yet implemented:" note
// sits under it. Signed-in screen: a built entry is a plain full-document link
// (as in ExplorerHomeNavigation.tsx, full document navigation retires this
// authenticated view and requests fresh server access); an entry that is not
// connected yet shows a grey "Not connected yet" line and, when activated, one
// sentence under it saying what it will do.

export const MENU_BUTTON_ID = "explorer-menu-button";
export const MENU_PANEL_ID = "explorer-menu-panel";

type MenuScope = "rail" | "menu";

const ITEM = "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors";
const ITEM_CURRENT = "border-amber-300/25 bg-amber-300/10 font-semibold text-amber-200";
const ITEM_OTHER =
  "border-transparent text-stone-300 hover:border-amber-200/15 hover:bg-white/[0.03] hover:text-stone-100";
const SPACE = "flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition-colors";
const SPACE_CURRENT = "bg-amber-300/10 text-amber-100";
const SPACE_OTHER = "text-stone-300 hover:bg-white/[0.03] hover:text-stone-100";
const EXPLANATION_SPACING = "mt-1 px-3";

function explanationId(scope: MenuScope, id: string): string {
  return `not-connected-${scope}-${id}`;
}

type MenuOpenChange = (open: boolean) => void;

// The entry for the page the Explorer is on stays a link, but a plain click on
// it does not reload the page (which would lose a typed message): it closes
// the phone menu and moves focus to the conversation heading. A click with a
// modifier key or another mouse button behaves as a normal link.
function stayOnThisPage(event: MouseEvent<HTMLAnchorElement>, onMenuOpenChange?: MenuOpenChange) {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  // No scroll is worked out while the open panel still sits above the heading;
  // once the panel closes, the heading moves up into view.
  document.getElementById(CONVERSATION_HEADING_ID)?.focus({ preventScroll: true });
  onMenuOpenChange?.(false);
}

function NavigationIcon({ id }: Readonly<{ id: ScreenNavigationItem["id"] }>) {
  const className = "mt-0.5 h-5 w-5";

  switch (id) {
    case "overview":
      return <IconOverview className={className} />;
    case "conversations":
      return <IconChat className={className} />;
    case "waypoints":
      return <IconMapPin className={className} />;
    case "settings":
      return <IconGear className={className} />;
  }
}

type SpacesProps = Readonly<{
  scope: MenuScope;
  spaces: readonly ScreenConversationSpace[];
  guideName: string;
  onMenuOpenChange?: MenuOpenChange;
}>;

function ConversationSpaces({ scope, spaces, guideName, onMenuOpenChange }: SpacesProps) {
  return (
    <ul aria-label="Conversation spaces" className="ml-6 mt-1 grid gap-1 border-l border-amber-200/15 pl-3">
      {spaces.map((space) => {
        const className = joinClasses(SPACE, space.current ? SPACE_CURRENT : SPACE_OTHER, FOCUS_RING);
        const label = <span className="font-medium">{space.label}</span>;
        const description = space.description ? <span className="text-[11px] text-stone-400">{space.description}</span> : null;

        if ("noteKey" in space) {
          const id = noteId(scope, space.noteKey);
          return (
            <li className="grid gap-1.5" key={space.id}>
              <UnwiredButton className={className} current={space.current ? "true" : undefined} noteId={id}>
                {label}
                {description}
              </UnwiredButton>
              <NotYetImplementedNote guideName={guideName} id={id} noteKey={space.noteKey} />
            </li>
          );
        }

        if (space.href !== null) {
          return (
            <li key={space.id}>
              <a
                aria-current={space.current ? "page" : undefined}
                className={className}
                href={space.href}
                onClick={space.current ? (event) => stayOnThisPage(event, onMenuOpenChange) : undefined}
              >
                {label}
                {description}
              </a>
            </li>
          );
        }

        const id = explanationId(scope, space.id);
        return (
          <li key={space.id}>
            <NotConnectedButton className={className} explanationId={id}>
              {label}
              <NotConnectedLine />
            </NotConnectedButton>
            <NotConnectedExplanation className={EXPLANATION_SPACING} id={id} text={space.explanation} />
          </li>
        );
      })}
    </ul>
  );
}

type ItemProps = Readonly<{ item: ScreenNavigationItem; scope: MenuScope; guideName: string }>;

function NavigationEntry({ item, scope, guideName }: ItemProps) {
  const className = joinClasses(ITEM, item.current ? ITEM_CURRENT : ITEM_OTHER, FOCUS_RING);

  if ("noteKey" in item) {
    const id = noteId(scope, item.noteKey);
    return (
      <>
        <UnwiredButton className={className} current={item.current ? "page" : undefined} noteId={id}>
          <NavigationIcon id={item.id} />
          {item.label}
        </UnwiredButton>
        <NotYetImplementedNote guideName={guideName} id={id} noteKey={item.noteKey} />
      </>
    );
  }

  if (item.href !== null) {
    return (
      <a className={className} href={item.href}>
        <NavigationIcon id={item.id} />
        <span className="flex min-w-0 flex-col">
          <span>{item.label}</span>
          {item.current ? <span className="sr-only">(current section)</span> : null}
        </span>
      </a>
    );
  }

  const id = explanationId(scope, item.id);
  return (
    <>
      <NotConnectedButton className={className} explanationId={id}>
        <NavigationIcon id={item.id} />
        <span className="flex min-w-0 flex-col">
          <span>{item.label}</span>
          <NotConnectedLine />
        </span>
      </NotConnectedButton>
      <NotConnectedExplanation className={EXPLANATION_SPACING} id={id} text={item.explanation} />
    </>
  );
}

// guideName is the Guide name the review notes show.
type MenuData = Readonly<{
  navigation: readonly ScreenNavigationItem[];
  spaces: readonly ScreenConversationSpace[];
  guideName: string;
}>;

type WorkspaceMenuProps = MenuData &
  Readonly<{
    scope: MenuScope;
    className?: string;
    onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
    onMenuOpenChange?: MenuOpenChange;
  }>;

// One list for both places. The conversation spaces show under Conversations
// when it is this screen's section.
function WorkspaceMenu({ navigation, spaces, guideName, scope, className, onKeyDown, onMenuOpenChange }: WorkspaceMenuProps) {
  return (
    <nav
      aria-label={scope === "rail" ? EXPLORER_MENU_LABELS.rail : EXPLORER_MENU_LABELS.phone}
      className={className}
      onKeyDown={onKeyDown}
    >
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
        {EXPLORER_MENU_LABELS.heading}
      </p>
      <ul className="mt-2 grid gap-1">
        {navigation.map((item) => (
          <li className={"noteKey" in item ? "grid gap-1.5" : undefined} key={item.id}>
            <NavigationEntry guideName={guideName} item={item} scope={scope} />
            {item.id === "conversations" && item.current ? (
              <ConversationSpaces guideName={guideName} onMenuOpenChange={onMenuOpenChange} scope={scope} spaces={spaces} />
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function RailNavigation(data: MenuData & Readonly<{ onMenuOpenChange: MenuOpenChange }>) {
  return <WorkspaceMenu {...data} className="px-3" scope="rail" />;
}

type MenuButtonProps = Readonly<{ menuOpen: boolean; onMenuOpenChange: MenuOpenChange; connected: boolean }>;

// The September 23 Menu button, first in the top bar below 64rem. In the
// review version it changes only what shows, so it carries the layout tag.
export function MenuButton({ menuOpen, onMenuOpenChange, connected }: MenuButtonProps) {
  const button = (
    <button
      aria-controls={MENU_PANEL_ID}
      aria-expanded={menuOpen}
      className={joinClasses(
        "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors border border-amber-200/25 bg-white/[0.03] px-3 py-2 text-stone-100 hover:border-amber-300/60 hover:bg-amber-300/10 lg:hidden",
        FOCUS_RING,
      )}
      data-preview-control={connected ? undefined : "layout"}
      id={MENU_BUTTON_ID}
      onClick={() => onMenuOpenChange(!menuOpen)}
      type="button"
    >
      {menuOpen ? <IconClose /> : <IconMenu />}
      Menu
    </button>
  );

  return connected ? button : <span className="inline-flex items-center gap-2 lg:hidden">{button}<LayoutOnlyTag /></span>;
}

type MenuPanelProps = MenuData & Readonly<{ menuOpen: boolean; onMenuOpenChange: MenuOpenChange }>;

// The open list sits in the page flow directly under the top bar. Escape
// inside it closes it and returns focus to the Menu button.
export function MenuPanel({ menuOpen, onMenuOpenChange, ...data }: MenuPanelProps) {
  function closeOnEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onMenuOpenChange(false);
    document.getElementById(MENU_BUTTON_ID)?.focus();
  }

  return (
    <div className="border-b border-amber-200/10 bg-black/90 px-3 py-3 lg:hidden" hidden={!menuOpen} id={MENU_PANEL_ID}>
      {menuOpen ? <WorkspaceMenu {...data} onKeyDown={closeOnEscape} onMenuOpenChange={onMenuOpenChange} scope="menu" /> : null}
    </div>
  );
}
