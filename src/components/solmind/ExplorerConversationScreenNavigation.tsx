import type { ScreenConversationSpace, ScreenNavigationItem } from "@/lib/solmind/explorerConversationScreenDisplay";

import { IconChat, IconGear, IconMapPin, IconOverview } from "./ExplorerConversationScreenIcons";
import {
  FOCUS_RING, LayoutOnlyTag, NotYetImplementedNote, QUIET_BUTTON, SECONDARY_BUTTON, UnwiredButton, joinClasses, noteId,
} from "./ExplorerConversationScreenNotYetImplemented";

// Jade rail navigation (wide screens) and the icon strip (narrow screens).
// Every destination is unwired and explains itself; only the narrow
// "conversation spaces" switch acts, and it changes only what shows.

export const SPACES_LIST_ID = "conversation-preview-spaces";

function NavigationIcon({ id, className }: Readonly<{ id: ScreenNavigationItem["id"]; className: string }>) {
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

type SpacesProps = Readonly<{ scope: string; spaces: readonly ScreenConversationSpace[]; guideName: string }>;

function ConversationSpaces({ scope, spaces, guideName }: SpacesProps) {
  const newConversationNote = noteId(scope, "newConversation");

  return (
    <ul aria-label="Conversation spaces" className="grid gap-2 border-l border-amber-200/15 pl-3">
      {spaces.map((space) => (
        <li className="grid gap-1.5" key={space.id}>
          <UnwiredButton
            className={joinClasses(
              "flex w-full flex-col rounded-lg border px-3 py-2 text-left text-sm",
              space.current ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-transparent text-stone-300",
              FOCUS_RING,
            )}
            current={space.current ? "true" : undefined}
            noteId={noteId(scope, space.noteKey)}
          >
            <span className="font-medium">{space.label}</span>
            <span className="text-[11px] text-stone-400">{space.description}</span>
          </UnwiredButton>
          <NotYetImplementedNote guideName={guideName} id={noteId(scope, space.noteKey)} noteKey={space.noteKey} />
        </li>
      ))}
      <li className="grid gap-1.5">
        <UnwiredButton className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")} noteId={newConversationNote}>
          <IconChat />
          Start a new conversation
        </UnwiredButton>
        <NotYetImplementedNote id={newConversationNote} noteKey="newConversation" />
      </li>
    </ul>
  );
}

// guideName is the Guide name the notes show.
type NavigationProps = Readonly<{
  navigation: readonly ScreenNavigationItem[];
  spaces: readonly ScreenConversationSpace[];
  guideName: string;
}>;

export function RailNavigation({ navigation, spaces, guideName }: NavigationProps) {
  return (
    <nav aria-label="Explorer workspace" className="px-3">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Workspace</p>
      <ul className="mt-2 grid gap-3">
        {navigation.map((item) => (
          <li className="grid gap-1.5" key={item.id}>
            <UnwiredButton
              className={joinClasses(
                "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm",
                item.current
                  ? "border-amber-300/25 bg-amber-300/10 font-semibold text-amber-200"
                  : "border-stone-800 text-stone-300",
                FOCUS_RING,
              )}
              current={item.current ? "page" : undefined}
              noteId={noteId("rail", item.noteKey)}
            >
              <NavigationIcon className="mt-0.5 h-5 w-5" id={item.id} />
              {item.label}
            </UnwiredButton>
            <NotYetImplementedNote guideName={guideName} id={noteId("rail", item.noteKey)} noteKey={item.noteKey} />
            {item.id === "conversations" ? (
              <div className="ml-6 mt-1">
                <ConversationSpaces guideName={guideName} scope="rail" spaces={spaces} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}

type NarrowNavigationProps = NavigationProps &
  Readonly<{
    spacesOpen: boolean;
    onToggleSpaces: () => void;
    // On the connected screen the spaces switch is a real control, so it
    // carries no "Layout only" tag or preview marker.
    connected?: boolean;
  }>;

// Jade's narrow icon strip replaces the S01R2 dropdown menu below 64rem.
export function NarrowNavigation({
  navigation,
  spaces,
  guideName,
  spacesOpen,
  onToggleSpaces,
  connected = false,
}: NarrowNavigationProps) {
  return (
    <nav aria-label="Explorer workspace" className="border-b border-amber-200/10 bg-black/80 px-3 py-3 sm:px-6 lg:hidden">
      <ul className="grid grid-cols-4 gap-1.5">
        {navigation.map((item) => (
          <li className="min-w-0" key={item.id}>
            <UnwiredButton
              className={joinClasses(
                "flex w-full min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center text-[11px] leading-4",
                item.current ? "border-amber-300/30 bg-amber-300/10 font-semibold text-amber-200" : "border-stone-800 text-stone-300",
                FOCUS_RING,
              )}
              current={item.current ? "page" : undefined}
              noteId={noteId("strip", item.noteKey)}
            >
              <NavigationIcon className="h-5 w-5" id={item.id} />
              <span className="max-w-full [overflow-wrap:anywhere]">{item.shortLabel}</span>
            </UnwiredButton>
          </li>
        ))}
      </ul>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {navigation.map((item) => (
          <NotYetImplementedNote guideName={guideName} id={noteId("strip", item.noteKey)} key={item.id} noteKey={item.noteKey} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          aria-controls={SPACES_LIST_ID}
          aria-expanded={spacesOpen}
          className={joinClasses(SECONDARY_BUTTON, "px-3 py-1.5 text-xs")}
          data-preview-control={connected ? undefined : "layout"}
          onClick={onToggleSpaces}
          type="button"
        >
          <IconChat />
          {spacesOpen ? "Hide conversation spaces" : "Show conversation spaces"}
        </button>
        {connected ? null : <LayoutOnlyTag />}
      </div>
      <div className="mt-2" hidden={!spacesOpen} id={SPACES_LIST_ID}>
        {spacesOpen ? <ConversationSpaces guideName={guideName} scope="strip" spaces={spaces} /> : null}
      </div>
    </nav>
  );
}
