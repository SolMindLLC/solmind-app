import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import type {
  ScreenConversationSpace, ScreenNavigationItem, WorkspaceMenuLabels,
} from "@/lib/solmind/explorerConversationScreenDisplay";

import { CONVERSATION_HEADING_ID } from "./ExplorerConversationScreenHeader";
import { IconClose, IconMenu, MENU_ICONS } from "./ExplorerConversationScreenIcons";
import {
  FOCUS_RING, LayoutOnlyTag, NotConnectedButton, NotConnectedExplanation, NotConnectedLine, NotYetImplementedNote,
  UnwiredButton, joinClasses, noteId,
} from "./ExplorerConversationScreenNotYetImplemented";

// The workspace menu: the September 23 list Paul accepted (his 2026-11-02
// option A), in the wide-screen rail and, below 64rem, in the panel the top
// bar's Menu button opens. The class strings are copied from
// ExplorerCompassComparisonParts.tsx. The list takes its entries and names as
// props, so the workspace frame (WorkspaceFrame.tsx) reuses it unchanged for
// the Explorer menu and the August Guide menu.
//
// Review version: every entry is unwired and its "Not yet implemented:" note
// sits under it. Signed-in screens: a built entry is a plain full-document link
// (full document navigation retires this
// authenticated view and requests fresh server access); an entry that is not
// connected yet shows a blue "Not connected yet" build-note label and, when activated, one
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
// While a sign-out is pending, a link shows in this non-link form, as on the
// Explorer home (ExplorerOverviewHome.tsx).
const LINK_DISABLED = "opacity-60";

function explanationId(scope: MenuScope, id: string): string {
  return `not-connected-${scope}-${id}`;
}

type MenuOpenChange = (open: boolean) => void;

// How the page's own entry and its links behave. pageHeadingId is the heading
// a plain click on the page's own entry focuses (the conversation heading by
// default); linksDisabled turns every link into its non-link form.
type LinkBehaviour = Readonly<{ pageHeadingId?: string; linksDisabled?: boolean; onMenuOpenChange?: MenuOpenChange }>;

// The entry for the page the Explorer is on stays a link, but a plain click on
// it does not reload the page (which would lose a typed message): it closes
// the phone menu and moves focus to the page heading. A click with a modifier
// key or another mouse button behaves as a normal link.
function stayOnThisPage(event: MouseEvent<HTMLAnchorElement>, behaviour: LinkBehaviour) {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  // No scroll is worked out while the open panel still sits above the heading;
  // once the panel closes, the heading moves up into view.
  document.getElementById(behaviour.pageHeadingId ?? CONVERSATION_HEADING_ID)?.focus({ preventScroll: true });
  behaviour.onMenuOpenChange?.(false);
}

type EntryLinkProps = Readonly<{ href: string; page: boolean; className: string; children: ReactNode; behaviour: LinkBehaviour }>;

function EntryLink({ href, page, className, children, behaviour }: EntryLinkProps) {
  if (behaviour.linksDisabled) {
    return <span aria-disabled="true" className={joinClasses(className, LINK_DISABLED)}>{children}</span>;
  }

  return (
    <a
      aria-current={page ? "page" : undefined}
      className={className}
      href={href}
      onClick={page ? (event) => stayOnThisPage(event, behaviour) : undefined}
    >
      {children}
    </a>
  );
}

function NavigationIcon({ id }: Readonly<{ id: string }>) {
  const Icon = MENU_ICONS[id];
  return Icon === undefined ? null : <Icon className="mt-0.5 h-5 w-5" />;
}

type SpacesProps = Readonly<{
  scope: MenuScope;
  spaces: readonly ScreenConversationSpace[];
  label: string;
  guideName: string;
  behaviour: LinkBehaviour;
}>;

function ConversationSpaces({ scope, spaces, label: listLabel, guideName, behaviour }: SpacesProps) {
  return (
    <ul aria-label={listLabel} className="ml-6 mt-1 grid gap-1 border-l border-amber-200/15 pl-3">
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
              <EntryLink behaviour={behaviour} className={className} href={space.href} page={space.current}>
                {label}
                {description}
              </EntryLink>
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

type ItemProps = Readonly<{ item: ScreenNavigationItem; scope: MenuScope; guideName: string; behaviour: LinkBehaviour }>;

function NavigationEntry({ item, scope, guideName, behaviour }: ItemProps) {
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
      <EntryLink behaviour={behaviour} className={className} href={item.href} page={item.current === "page"}>
        <NavigationIcon id={item.id} />
        <span className="flex min-w-0 flex-col">
          <span>{item.label}</span>
          {item.current === true ? <span className="sr-only">(current section)</span> : null}
        </span>
      </EntryLink>
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

// labels are the menu's names. guideName is the Guide name the review notes
// show. The spaces show under the current entry; pass none where they do not
// belong.
export type MenuData = Readonly<{
  labels: WorkspaceMenuLabels;
  navigation: readonly ScreenNavigationItem[];
  spaces: readonly ScreenConversationSpace[];
  guideName: string;
}> &
  Omit<LinkBehaviour, "onMenuOpenChange">;

type WorkspaceMenuProps = MenuData &
  Readonly<{
    scope: MenuScope;
    className?: string;
    onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
    onMenuOpenChange?: MenuOpenChange;
  }>;

// One list for both places.
function WorkspaceMenu({ labels, navigation, spaces, guideName, scope, className, onKeyDown, ...behaviour }: WorkspaceMenuProps) {
  return (
    <nav
      aria-busy={behaviour.linksDisabled || undefined}
      aria-label={scope === "rail" ? labels.rail : labels.phone}
      className={className}
      onKeyDown={onKeyDown}
    >
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">{labels.heading}</p>
      <ul className="mt-2 grid gap-1">
        {navigation.map((item) => (
          <li className={"noteKey" in item ? "grid gap-1.5" : undefined} key={item.id}>
            <NavigationEntry behaviour={behaviour} guideName={guideName} item={item} scope={scope} />
            {item.current && spaces.length > 0 ? (
              <ConversationSpaces behaviour={behaviour} guideName={guideName} label={labels.spaces} scope={scope} spaces={spaces} />
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
