import { createContext, useContext, useState, type MouseEvent, type ReactNode } from "react";

import { BUILD_NOTE_WORDING } from "@/lib/solmind/explorerConversationScreen";
import { WORKSPACE_NOT_CONNECTED_LABEL } from "@/lib/solmind/workspaceNavigation";

import { IconClose, IconEye, IconEyeOff } from "./ExplorerConversationScreenIcons";

// Build notes on the signed-in screens (Paul's rule, decision queue 2026-11-03
// 17:59:20, 18:00:59, 18:03:39, 18:30:50, 18:32:04 and 18:33:15 CST; the
// section "Pages under development: build notes" in solmind-docs
// ai-assistant/02). They are for the people reviewing the work, never
// messages to users, and are never released: scripts/checkReleaseCandidate.mjs
// fails while any remains, and a release candidate for UAT or production must
// pass it.
// - A control not built yet keeps its small "Not connected yet" label, in the
//   reserved build-note blue (BuildNoteLabel).
// - A note for an area not built yet is a blue dashed box with an X in its
//   upper corner that hides that box (BuildNoteBox).
// - A part planned for removal gets a dashed violet outline (REMOVAL_OUTLINE)
//   and a small violet "Planned for removal" tag that shows one sentence
//   saying why (RemovalTag). The part keeps working.
// One page toggle in the top bar (BuildNotesToggle) hides or shows all of
// them; an X hides only its box, which stays hidden while the toggle is off;
// turning the toggle on shows every box again, including those closed with
// their X. Nothing is saved: a reload shows them all. Each carries the fixed
// attribute data-build-note or data-removal-marker, which the check finds.
//
// The colours are reserved for these notes and used nowhere else in the app:
// the build-note blue #4A86FF is a vivid royal blue (hue 220), on a deep navy
// #071433 with pale text #D6E4FF. It is not the pale sky blue #8BC6EE of the
// "You" speaker label (hue 204, explorerSpeakerStyle.ts), the cyan of the
// current tools (hue 187), or the pale indigo of the private Waypoint panels
// and pill (indigo-300, hue 230), which is why it is not an indigo. The
// violet #D27BFF (hue 280) appears on no live screen. Without
// BuildNotesProvider (the review version) there is no
// toggle and every note shows. This file imports no other part of the screen
// except its icons, because ExplorerConversationScreenNotYetImplemented.tsx
// imports it.

function joinClasses(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// The same focus ring as the screen's other controls.
const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

// Which notes show: the toggle (shown) and the boxes closed with their X
// (closed, by their sentence id). Pure, so the rules are tested on their own.
export type BuildNotesView = Readonly<{ shown: boolean; closed: readonly string[] }>;

export const BUILD_NOTES_START: BuildNotesView = Object.freeze({ shown: true, closed: Object.freeze([]) });

// Off keeps the closed boxes closed; on shows every box again.
export function toggleBuildNotes(view: BuildNotesView): BuildNotesView {
  return view.shown ? { shown: false, closed: view.closed } : { shown: true, closed: [] };
}

export function closeBuildNote(view: BuildNotesView, id: string): BuildNotesView {
  return view.closed.includes(id) ? view : { shown: view.shown, closed: [...view.closed, id] };
}

// A box needs its id: closing one with its X hides only that one.
export function buildNoteShown(view: BuildNotesView, id?: string): boolean {
  return view.shown && (id === undefined || !view.closed.includes(id));
}

type BuildNotesState = Readonly<{ view: BuildNotesView; onToggle: () => void; onClose: (id: string) => void }>;

const BuildNotesContext = createContext<BuildNotesState | null>(null);

// Layout state of the client boundary that places the provider
// (ExplorerConversationConnectedScreen.tsx, WorkspaceFrame.tsx), never saved.
export function useBuildNotesState(): BuildNotesState {
  const [view, setView] = useState<BuildNotesView>(BUILD_NOTES_START);
  return {
    view,
    onToggle: () => setView(toggleBuildNotes),
    onClose: (id: string) => setView((current) => closeBuildNote(current, id)),
  };
}

export function BuildNotesProvider({ state, children }: Readonly<{ state: BuildNotesState; children: ReactNode }>) {
  return <BuildNotesContext value={state}>{children}</BuildNotesContext>;
}

// Whether the page's notes and markers show (always, without the provider).
export function useBuildNotesShown(): boolean {
  const notes = useContext(BuildNotesContext);
  return notes === null || notes.view.shown;
}

// The small blue label on a control not built yet.
export function BuildNoteLabel() {
  return useBuildNotesShown() ? (
    <span className="text-[11px] font-normal text-[#4A86FF]" data-build-note="label">
      {WORKSPACE_NOT_CONNECTED_LABEL}
    </span>
  ) : null;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// When a box closes, focus moves to the last control before it in the same
// dialog or page (an area that holds the box, such as the scrolling
// transcript, counts), so focus is never lost and never leaves the phone
// drawer.
function focusBefore(box: HTMLElement) {
  const root = box.closest("dialog") ?? document.body;
  const candidates = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !box.contains(element) && element.getClientRects().length > 0,
  );
  const before = candidates.filter((element) => element.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING);
  (before.at(-1) ?? candidates[0])?.focus();
}

const BOX_CLASS =
  "relative grid gap-0.5 rounded-lg border border-dashed border-[#4A86FF] bg-[#071433] py-1.5 pl-2.5 pr-9 text-left [overflow-wrap:anywhere]";
const CLOSE_CLASS = joinClasses(
  "absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full text-[#4A86FF] hover:bg-[#4A86FF]/20",
  FOCUS_RING,
);

type BoxProps = Readonly<{ id: string; text: string; className?: string }>;

// A note for an area not built yet: the label words, the sentence (id) and
// the X, which hides this box only.
export function BuildNoteBox({ id, text, className }: BoxProps) {
  const notes = useContext(BuildNotesContext);
  if (notes !== null && !buildNoteShown(notes.view, id)) return null;

  const close = (event: MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.parentElement;
    if (box !== null) focusBefore(box);
    notes?.onClose(id);
  };

  return (
    <div className={joinClasses(BOX_CLASS, className)} data-build-note="box">
      <p className="text-[11px] font-semibold leading-4 text-[#4A86FF]">{WORKSPACE_NOT_CONNECTED_LABEL}</p>
      <p className="text-xs leading-5 text-[#D6E4FF]" id={id}>
        {text}
      </p>
      {notes === null ? null : (
        <button aria-describedby={id} aria-label={BUILD_NOTE_WORDING.hide} className={CLOSE_CLASS} onClick={close} type="button">
          <IconClose />
        </button>
      )}
    </div>
  );
}

export const BUILD_NOTES_TOGGLE_ID = "build-notes-toggle";

// The page toggle, first in the top bar's right-hand group, only where the
// boundary places BuildNotesProvider. Its name stays "Build notes"; aria-pressed
// and the eye icon say whether the notes show. It is no taller than the bell.
export function BuildNotesToggle() {
  const notes = useContext(BuildNotesContext);
  if (notes === null) return null;
  const { shown } = notes.view;
  const Icon = shown ? IconEye : IconEyeOff;

  return (
    <button
      aria-pressed={shown}
      className={joinClasses(
        "flex h-10 items-center gap-2 rounded-full border border-[#4A86FF] px-3 text-xs font-semibold text-[#4A86FF] hover:bg-[#071433]",
        shown && "bg-[#071433]",
        FOCUS_RING,
      )}
      data-build-note="toggle"
      id={BUILD_NOTES_TOGGLE_ID}
      onClick={notes.onToggle}
      type="button"
    >
      <Icon />
      {BUILD_NOTE_WORDING.toggle}
    </button>
  );
}

// The dashed violet outline of a part planned for removal, while the notes show.
export const REMOVAL_OUTLINE = "outline-2 outline-offset-2 outline-dashed outline-[#D27BFF]";

type RemovalTagProps = Readonly<{ id: string; reason: string }>;

// The violet tag on a part planned for removal. Tapping it shows or hides one
// sentence (id) saying why; the part itself keeps working. While the toggle
// hides the notes the tag is unmounted, so it holds no open state and comes
// back with its sentence closed.
export function RemovalTag({ id, reason }: RemovalTagProps) {
  return useBuildNotesShown() ? <RemovalTagShown id={id} reason={reason} /> : null;
}

function RemovalTagShown({ id, reason }: RemovalTagProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="grid min-w-0 justify-items-start gap-1" data-removal-marker="tag">
      <button
        aria-controls={id}
        aria-expanded={open}
        className={joinClasses(
          "rounded-full border border-dashed border-[#D27BFF] bg-[#1C0F2E] px-2.5 py-0.5 text-[11px] font-semibold text-[#D27BFF] hover:bg-[#D27BFF]/20",
          FOCUS_RING,
        )}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {BUILD_NOTE_WORDING.removalTag}
      </button>
      <p className="text-xs leading-5 text-[#F0DDFF]" hidden={!open} id={id}>
        {reason}
      </p>
    </div>
  );
}
